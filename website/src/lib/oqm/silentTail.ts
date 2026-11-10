/** Experimental port of the silent-tail recipe in buwryme/tiktok-lossless-upload
 * commit 348c179f21eef1202d22faabf704b80d78f216ca. Attribution/license: THIRD_PARTY_NOTICES.md.
 * No legacy patches are layered onto this recipe. Original media stays at its original offsets.
 */
import { Box, OqmError, readTopLevel, type PatchResult } from "./patch";

const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
const silentFrame = Uint8Array.of(33, 16, 4, 96, 140, 28);
const requireThat = (ok: unknown, detail: string): void => { if (!ok) throw new OqmError(`Silent-tail: ${detail}. Use a clean MP4 with one AAC-LC stereo audio track.`); };
const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const read = (b: Uint8Array, at: number, width = 4): number => {
  requireThat(at >= 0 && at + width <= b.length, "truncated header");
  const value = width === 8 ? Number(dv(b).getBigUint64(at)) : dv(b).getUint32(at);
  requireThat(Number.isSafeInteger(value), "unsupported large integer");
  return value;
};
const write = (b: Uint8Array, at: number, value: number, width = 4) => {
  requireThat(Number.isSafeInteger(value) && value >= 0 && (width === 8 || value < 0xffffffff), "header value overflow");
  if (width === 8) dv(b).setBigUint64(at, BigInt(value)); else dv(b).setUint32(at, value);
};
const join = (...parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0)); let at = 0; for (const b of parts) { out.set(b, at); at += b.length; } return out; };
const words = (...values: number[]) => { const b = new Uint8Array(values.length * 4); values.forEach((v, i) => write(b, i * 4, v)); return b; };
const child = (box: Box, ...path: string[]): Box => { const b = box.find(...path); requireThat(b, `missing ${path.join("/")}`); return b!; };
const containers = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf"]);
/** Unlike the legacy parser, reject every truncated child. This port accepts bounded 32-bit index boxes. */
function parseBoxes(data: Uint8Array, depth = 0): Box[] {
  requireThat(depth < 16, "movie index nesting too deep");
  const boxes: Box[] = [];
  for (let at = 0; at < data.length;) {
    requireThat(at + 8 <= data.length, "truncated child box");
    const size = read(data, at), type = String.fromCharCode(...data.slice(at + 4, at + 8));
    requireThat(size >= 8 && at + size <= data.length, "unsupported or truncated child box");
    const payload = data.slice(at + 8, at + size);
    boxes.push(new Box(type, containers.has(type) ? { children: parseBoxes(payload, depth + 1) } : { payload }));
    at += size;
  }
  return boxes;
}
const cloneBox = (box: Box): Box => new Box(box.type, box.children ? { children: box.children.map(cloneBox) } : { payload: box.payload.slice() });
const tableCount = (box: Box, stride: number) => {
  const b = box.payload, n = read(b, 4);
  requireThat(read(b, 0) === 0 && b.length === 8 + n * stride && n <= 5_000_000, `invalid ${box.type} table`);
  return n;
};
function fields(box: Box) {
  const b = box.payload;
  requireThat(b[0] === 0 || b[0] === 1, "unsupported header version");
  const width = b[0] === 1 ? 8 : 4;
  const offset = box.type === "tkhd" ? (width === 8 ? 28 : 20) : (width === 8 ? 24 : 16);
  return { offset, width, duration: read(b, offset, width), scale: box.type === "tkhd" ? 0 : read(b, offset - 4) };
}
function descriptor(data: Uint8Array, start: number) {
  requireThat(start < data.length, "missing AAC descriptor");
  let pos = start + 1, length = 0;
  for (let i = 0; i < 4; i++) {
    requireThat(pos < data.length, "truncated AAC descriptor");
    const value = data[pos++]; length = length * 128 + (value & 127);
    if (!(value & 128)) { requireThat(pos + length <= data.length, "invalid AAC descriptor length"); return { tag: data[start], start: pos, end: pos + length }; }
  }
  throw new OqmError("Silent-tail: invalid AAC descriptor.");
}
const packDescriptor = (tag: number, b: Uint8Array) => join(Uint8Array.of(tag, 128 | (b.length >> 21), 128 | ((b.length >> 14) & 127), 128 | ((b.length >> 7) & 127), b.length & 127), b);
function audioDescription(stsd: Box) {
  const data = stsd.payload;
  requireThat(data.length >= 44 && read(data, 0) === 0 && read(data, 4) === 1, "unsupported audio sample descriptions");
  const sample = data.slice(8);
  requireThat(String.fromCharCode(...sample.slice(4, 8)) === "mp4a" && read(sample, 0) === sample.length && sample[16] === 0 && sample[17] === 0 && sample[24] === 0 && sample[25] === 2, "audio must be unencrypted AAC stereo");
  const entries = parseBoxes(sample.slice(36)), esds = entries.find(b => b.type === "esds");
  requireThat(esds && !entries.some(b => b.type === "sinf" || b.type === "wave"), "unsupported AAC description");
  const e = esds!.payload;
  requireThat(read(e, 0) === 0, "unsupported esds flags");
  const decoder = descriptor(e, 4);
  requireThat(decoder.tag === 3 && decoder.end - decoder.start >= 3 && e[decoder.start + 2] === 0, "unsupported ES descriptor");
  let rateIndex = -1;
  const rebuilt: Uint8Array[] = [];
  for (let pos = decoder.start + 3; pos < decoder.end;) {
    const item = descriptor(e.subarray(0, decoder.end), pos);
    if (item.tag !== 4) rebuilt.push(e.slice(pos, item.end));
    else {
      requireThat(item.end - item.start >= 13 && e[item.start] === 64, "audio must be AAC");
      const nested: Uint8Array[] = [];
      for (let at = item.start + 13; at < item.end;) {
        const sub = descriptor(e.subarray(0, item.end), at);
        if (sub.tag !== 5) nested.push(e.slice(at, sub.end));
        else {
          const config = e.slice(sub.start, sub.end);
          requireThat(rateIndex < 0 && config.length >= 2 && config[0] >> 3 === 2 && (config[1] & 127) === 16, "audio must be AAC-LC stereo");
          rateIndex = ((config[0] & 7) << 1) | (config[1] >> 7);
          const bits = Array.from(config.slice(2), b => b.toString(2).padStart(8, "0")).join("");
          requireThat(rateIndex < rates.length && (!bits.includes("1") || /^01010110111001010*$/.test(bits)), "unsupported AAC configuration");
          const rate = rateIndex.toString(2).padStart(4, "0");
          let replacement = "00010" + rate + "0000000000001" + rate + "00000001000000000000000010000";
          replacement = replacement.padEnd(Math.ceil(replacement.length / 8) * 8, "0") + "00000000";
          nested.push(packDescriptor(5, Uint8Array.from(replacement.match(/.{8}/g)!, b => parseInt(b, 2))));
        }
        at = sub.end;
      }
      rebuilt.push(packDescriptor(4, join(e.slice(item.start, item.start + 13), ...nested)));
    }
    pos = item.end;
  }
  requireThat(rateIndex >= 0, "missing AAC configuration");
  esds!.payload = join(e.slice(0, 4), packDescriptor(3, join(e.slice(decoder.start, decoder.start + 3), ...rebuilt)), e.slice(decoder.end));
  const replacement = new Box("mp4a", { payload: join(sample.slice(8, 36), ...entries.map(b => b.serialize())) }).serialize();
  return { sampleRate: rates[rateIndex], payload: join(words(0, 2), sample, replacement) };
}

export async function silentTail(file: Blob): Promise<PatchResult> {
  try { return await patchSilentTail(file); }
  catch (error) { if (error instanceof OqmError) throw error; throw new OqmError("Silent-tail: unsupported or malformed MP4. Use the current recipe or a clean AAC-LC stereo export."); }
}

async function patchSilentTail(file: Blob): Promise<PatchResult> {
  const top = await readTopLevel(file), moovs = top.filter(b => b.type === "moov"), mdats = top.filter(b => b.type === "mdat");
  requireThat(top.length > 0 && top.length < 10000 && top[top.length - 1].start + top[top.length - 1].size === file.size && !top.some(b => ["moof", "sidx", "mfra", "ssix"].includes(b.type)), "unsupported file layout or already patched file");
  requireThat(moovs.length === 1 && mdats.length > 0 && moovs[0].header === 8 && moovs[0].size <= 32 * 1024 * 1024, "unsupported movie index");
  const info = moovs[0], raw = new Uint8Array(await file.slice(info.start, info.start + info.size).arrayBuffer());
  const root = parseBoxes(raw)[0], tracks = root.findAll("trak");
  const kind = (t: Box) => String.fromCharCode(...child(t, "mdia", "hdlr").payload.slice(8, 12));
  const audioTracks = tracks.filter(t => kind(t) === "soun");
  requireThat(audioTracks.length === 1 && tracks.filter(t => kind(t) === "vide").length === 1, "requires one video and one audio track");
  const audio = audioTracks[0], media = child(audio, "mdia"), minf = child(media, "minf"), stbl = child(minf, "stbl");
  const dref = child(minf, "dinf", "dref").payload, refs = parseBoxes(dref.slice(8));
  requireThat(read(dref, 0) === 0 && read(dref, 4) === refs.length && refs.length && refs.every(r => r.type === "url " && read(r.payload, 0) === 1), "external media references unsupported");
  const allowed = new Set(["stsd", "stsz", "stsc", "stts", "stco", "co64", "sbgp", "sgpd", "subs", "free", "skip", "ctts", "stss", "stps", "sdtp", "stdp"]);
  requireThat(stbl.children!.every(c => allowed.has(c.type)), "unsupported audio sample table");
  const stsd = child(stbl, "stsd"), description = audioDescription(stsd);
  const stsz = child(stbl, "stsz"), sizes = stsz.payload, uniform = read(sizes, 4), samples = read(sizes, 8);
  requireThat(read(sizes, 0) === 0 && samples > 0 && samples <= 5_000_000 && sizes.length === 12 + (uniform ? 0 : samples * 4), "invalid sample sizes");
  const sizeAt = (i: number) => uniform || read(sizes, 12 + 4 * i);
  const stsc = child(stbl, "stsc"), runs = tableCount(stsc, 12);
  requireThat(!(stbl.find("stco") && stbl.find("co64")), "duplicate chunk tables");
  const offsets = stbl.find("stco") ?? child(stbl, "co64"), oldWidth = offsets.type === "co64" ? 8 : 4, chunks = tableCount(offsets, oldWidth);
  const firstChunk = (i: number) => read(stsc.payload, 8 + 12 * i);
  requireThat(runs > 0 && chunks > 0 && firstChunk(0) === 1, "invalid audio chunks");
  for (let i = 0; i < runs; i++) requireThat(firstChunk(i) <= chunks && (i === 0 || firstChunk(i) > firstChunk(i - 1)) && read(stsc.payload, 12 + 12 * i) > 0 && read(stsc.payload, 16 + 12 * i) === 1, "invalid audio chunk mapping");
  let run = 0, sampled = 0;
  for (let i = 0; i < chunks; i++) {
    if (run + 1 < runs && firstChunk(run + 1) === i + 1) run++;
    const n = read(stsc.payload, 12 + 12 * run); requireThat(sampled + n <= samples, "invalid sample count");
    let bytes = 0; for (let j = 0; j < n; j++) { const size = sizeAt(sampled++); requireThat(size > 0, "empty audio sample"); bytes += size; }
    const at = read(offsets.payload, 8 + i * oldWidth, oldWidth);
    requireThat(mdats.some(m => at >= m.start + m.header && at + bytes <= m.start + m.size), "audio chunk outside media data");
  }
  requireThat(sampled === samples, "incomplete audio mapping");
  const stts = child(stbl, "stts"), timings = tableCount(stts, 8), timing: number[][] = [];
  let audioDuration = 0, timed = 0;
  for (let i = 0; i < timings; i++) { const count = read(stts.payload, 8 + 8 * i), delta = read(stts.payload, 12 + 8 * i); requireThat(count > 0 && delta > 0, "invalid audio timing"); timing.push([count, delta]); timed += count; audioDuration += count * delta; }
  requireThat(timed === samples, "audio timing/sample mismatch");
  const mdhd = child(media, "mdhd"), mvhd = child(root, "mvhd"), tkhd = child(audio, "tkhd");
  const ah = fields(mdhd), mh = fields(mvhd), th = fields(tkhd), rate = description.sampleRate;
  requireThat(ah.scale > 0 && mh.scale > 0 && ah.duration > 0 && Math.abs(ah.duration - audioDuration) <= Math.ceil(2048 * ah.scale / rate) && (tkhd.payload[3] & 1) && th.duration > 0, "inconsistent audio duration");
  const tailFrames = Math.max(10, Math.ceil(.35 * rate / 1024));
  for (const item of stbl.children!) {
    const p = item.payload;
    if (item.type === "sbgp") {
      requireThat(p[0] === 0 || p[0] === 1, "unsupported audio groups"); const header = p[0] === 1 ? 12 : 8, groups = read(p, header);
      requireThat(p.length === header + 4 + groups * 8, "invalid audio groups");
      let covered = 0; for (let i = 0; i < groups; i++) covered += read(p, header + 4 + i * 8);
      requireThat(covered <= samples, "invalid grouped sample count"); const extra = samples - covered + tailFrames;
      if (groups && read(p, p.length - 4) === 0) write(p, p.length - 8, read(p, p.length - 8) + extra);
      else item.payload = join(p.slice(0, header), words(groups + 1), p.slice(header + 4), words(extra, 0));
    } else if (item.type === "ctts") {
      const n = tableCount(item, 8); let covered = 0;
      for (let i = 0; i < n; i++) { covered += read(p, 8 + i * 8); requireThat(read(p, 12 + i * 8) === 0, "unsupported audio composition offsets"); }
      requireThat(covered === samples, "incomplete composition table"); item.payload = join(words(0, n + 1), p.slice(8), words(tailFrames, 0));
    } else if (item.type === "stss" || item.type === "stps") {
      const n = tableCount(item, 4); let previous = 0;
      for (let i = 0; i < n; i++) { const value = read(p, 8 + i * 4); requireThat(value > previous && value <= samples, "invalid audio sync table"); previous = value; }
      item.payload = join(words(0, n + tailFrames), p.slice(8), words(...Array.from({ length: tailFrames }, (_, i) => samples + i + 1)));
    } else if (item.type === "sdtp" || item.type === "stdp") {
      const stride = item.type === "sdtp" ? 1 : 2; requireThat(p.length === 4 + stride * samples, "invalid dependency table"); item.payload = join(p, new Uint8Array(stride * tailFrames));
    }
  }
  const audioTail = Math.floor(tailFrames * 1024 * ah.scale / rate), movieTail = Math.round(audioTail * mh.scale / ah.scale);
  requireThat(movieTail > 0, "invalid silent tail duration");
  let editExtra = movieTail;
  const edts = audio.find("edts");
  if (edts) {
    const elst = child(edts, "elst"), p = elst.payload, width = p[0] === 1 ? 8 : 4, count = read(p, 4), stride = 2 * width + 4;
    requireThat((p[0] === 0 || p[0] === 1) && (count === 1 || count === 2) && p.length === 8 + count * stride, "unsupported audio edit list");
    const at = 8 + (count - 1) * stride, segment = read(p, at, width), mediaTime = read(p, at + width, width);
    requireThat(read(p, at + 2 * width) === 65536 && Math.abs(th.duration - segment - (count === 2 ? read(p, 8, width) : 0)) <= 1, "inconsistent audio edit list");
    if (count === 2) requireThat(p.slice(8 + width, 8 + 2 * width).every(b => b === 255) && read(p, 8 + 2 * width) === 65536, "unsupported empty edit");
    const difference = (audioDuration - mediaTime) * mh.scale - segment * ah.scale;
    requireThat(Math.abs(difference) <= Math.ceil(2048 * ah.scale / rate) * mh.scale, "unsupported priming trim");
    editExtra += Math.max(0, Math.ceil(difference / ah.scale)); write(p, at, segment + editExtra, width);
  } else requireThat(Math.abs(th.duration - Math.round(audioDuration * mh.scale / ah.scale)) <= 1, "inconsistent untrimmed audio");
  write(tkhd.payload, th.offset, th.duration + editExtra, th.width); write(mdhd.payload, ah.offset, ah.duration + audioTail, ah.width);
  for (let i = 0; i < tailFrames; i++) {
    const delta = Math.floor((i + 1) * 1024 * ah.scale / rate) - Math.floor(i * 1024 * ah.scale / rate);
    requireThat(delta > 0 && delta <= 0xffffffff, "invalid tail timing");
    if (timing[timing.length - 1][1] === delta) timing[timing.length - 1][0]++; else timing.push([1, delta]);
  }
  stts.payload = join(words(0, timing.length), ...timing.map(t => words(...t)));
  const newSizes = new Uint8Array(12 + 4 * (samples + tailFrames)); write(newSizes, 8, samples + tailFrames);
  for (let i = 0; i < samples + tailFrames; i++) write(newSizes, 12 + 4 * i, i < samples ? sizeAt(i) : silentFrame.length);
  stsz.payload = newSizes;
  const tailExtra = tailFrames - 8, first = file.size + 8, second = first + tailExtra * silentFrame.length, width = oldWidth === 8 || second > 0xffffffff ? 8 : 4;
  const newOffsets = new Uint8Array(8 + (chunks + 2) * width); write(newOffsets, 4, chunks + 2);
  for (let i = 0; i < chunks + 2; i++) write(newOffsets, 8 + i * width, i < chunks ? read(offsets.payload, 8 + i * oldWidth, oldWidth) : i === chunks ? first : second, width);
  offsets.type = width === 8 ? "co64" : "stco"; offsets.payload = newOffsets;
  const oldStsc = stsc.payload.slice(8), rebuildStsc = (desc: number) => join(words(0, runs + 2), oldStsc, words(chunks + 1, tailExtra, 1, chunks + 2, 8, desc));
  stsc.payload = rebuildStsc(1); const clone = cloneBox(audio); stsc.payload = rebuildStsc(2); stsd.payload = description.payload;
  const idAt = (t: Box) => child(t, "tkhd").payload[0] === 1 ? 20 : 12;
  const ids = tracks.map(t => read(child(t, "tkhd").payload, idAt(t)));
  requireThat(ids.every(Boolean) && new Set(ids).size === ids.length, "duplicate track identifiers");
  const nextId = Math.max(...ids) + 1; write(child(clone, "tkhd").payload, idAt(clone), nextId);
  const nextOffset = mvhd.payload[0] === 1 ? 108 : 96, oldNext = read(mvhd.payload, nextOffset);
  write(mvhd.payload, nextOffset, Math.max(nextId + 1, oldNext === 0xffffffff ? 0 : oldNext));
  if (mh.duration > 0 && !(mh.width === 4 && mh.duration === 0xffffffff)) {
    let longest = mh.duration; for (const t of tracks) { const f = fields(child(t, "tkhd")); if (f.duration > 0 && !(f.width === 4 && f.duration === 0xffffffff)) longest = Math.max(longest, f.duration); }
    write(mvhd.payload, mh.offset, longest, mh.width);
  }
  root.children!.splice(root.children!.indexOf(audio) + 1, 0, clone);
  const parts: BlobPart[] = [];
  for (const box of top) {
    if (box === info) parts.push(words(box.size) as BlobPart, new TextEncoder().encode("free") as BlobPart, file.slice(box.start + 8, box.start + box.size));
    else {
      const h = new Uint8Array(await file.slice(box.start, box.start + 4).arrayBuffer());
      if (read(h, 0) === 0) { requireThat(box.size < 0xffffffff, "oversized zero-length box"); parts.push(words(box.size) as BlobPart, file.slice(box.start + 4, box.start + box.size)); }
      else parts.push(file.slice(box.start, box.start + box.size));
    }
  }
  const silence = new Uint8Array(silentFrame.length * tailFrames); for (let i = 0; i < tailFrames; i++) silence.set(silentFrame, i * silentFrame.length);
  parts.push(new Box("mdat", { payload: silence }).serialize() as BlobPart, root.serialize() as BlobPart);
  return { blob: new Blob(parts, { type: "video/mp4" }), applied: ["silent-tail-v1"], skipped: [], notes: [`Experimental: ${tailFrames} silent AAC packets appended (~${(tailFrames * 1024 / rate).toFixed(3)}s); audio duplicated. TikTok retention is unverified.`], checks: [{ name: "Original media kept at original offsets", ok: true, detail: "original media copied from the input Blob" }, { name: "Intentional audio tail", ok: false, warn: true, detail: `adds ~${(tailFrames * 1024 / rate).toFixed(3)}s; inspect sync and looping locally` }] };
}
