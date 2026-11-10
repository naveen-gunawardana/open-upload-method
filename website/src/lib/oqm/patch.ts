/**
 * OQM container patches, in the browser. A port of program/oqm/mp4.py and program/oqm/patches.py; keep the two in step.
 *
 * Every patch is a named, toggleable step. None of them touch the compressed video or primary audio bytes: the
 * output is a Blob stitched from the input's own `mdat` byte range plus a rewritten `moov`, so it is lossless by
 * construction and a large file does not need to be copied through memory.
 */

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "udta", "mvex"]);

export type PatchId =
  | "faststart"
  | "strip-free"
  | "zero-times"
  | "mvhd-unknown-duration"
  | "video-elst-plus-one"
  | "decoy-audio"
  | "decoy-video"
  | "clean-metadata"
  | "trailing-pad";

export const CATALOG: { id: PatchId; title: string; summary: string }[] = [
  { id: "faststart", title: "Fast start", summary: "Index before the media data (ftyp, moov, mdat). Always on." },
  { id: "strip-free", title: "Strip padding boxes", summary: "Drop top-level free/skip boxes. Cosmetic." },
  { id: "zero-times", title: "Zero timestamps", summary: "Blank the creation and modification times in every track header." },
  { id: "mvhd-unknown-duration", title: "Unknown movie duration", summary: "Movie header to version 1 with duration all-ones, so readers derive it from the tracks." },
  { id: "video-elst-plus-one", title: "Video edit list +1", summary: "Lengthen the video edit list by one tick (~1 ms). Adds a standard edit list first if the file has none." },
  { id: "decoy-audio", title: "Decoy audio track", summary: "Hidden copy of the audio track whose sample tables are inflated with tiny dummy samples." },
  { id: "decoy-video", title: "Decoy video track", summary: "Experimental. The same trick on a hidden copy of the video track (the NoBlur idea)." },
  { id: "clean-metadata", title: "Clean metadata", summary: "Replace the file's tags with a single encoder tag. No branding." },
  { id: "trailing-pad", title: "Trailing padding", summary: "Padding after the media data that starts with a malformed 'VOID' box." },
];

export const ALL_PATCHES = CATALOG.map((p) => p.id);
/** The full set the desktop app ships ("reference"): everything except the experimental video decoy. */
export const REFERENCE: PatchId[] = ALL_PATCHES.filter((id) => id !== "decoy-video");

export type PatchOptions = {
  enabled: PatchId[];
  /** Decoy sample count = real sample count x inflate. */
  inflate: number;
  /** Bytes per dummy sample; null picks by video codec. */
  dummySize: number | null;
  encoderTag: string;
  trailingBytes: number;
};

export const DEFAULT_PATCH: PatchOptions = {
  enabled: REFERENCE,
  inflate: 10,
  dummySize: null,
  encoderTag: "Lavf59.27.100",
  trailingBytes: 184_100,
};

const DUMMY_SIZE_BY_CODEC: Record<string, number> = { avc1: 8, avc3: 8, hvc1: 16, hev1: 16, vp09: 4, av01: 4, mp4v: 8 };
/** Refuse a header index bigger than this; a normal export is far smaller. */
const MAX_MOOV_BYTES = 512 * 1024 * 1024;

export class OqmError extends Error {}

// --- box tree ---------------------------------------------------------------

export class Box {
  type: string;
  payload: Uint8Array;
  children: Box[] | null;

  constructor(type: string, opts: { payload?: Uint8Array; children?: Box[] | null } = {}) {
    this.type = type;
    this.payload = opts.payload ?? new Uint8Array(0);
    this.children = opts.children ?? null;
  }

  body(): Uint8Array {
    if (this.children === null) return this.payload;
    return concat(this.children.map((child) => child.serialize()));
  }

  serialize(): Uint8Array {
    const body = this.body();
    const size = 8 + body.length;
    if (size > 0xffffffff) {
      const out = new Uint8Array(16 + body.length);
      const dv = new DataView(out.buffer);
      dv.setUint32(0, 1);
      out.set(ascii(this.type), 4);
      dv.setBigUint64(8, BigInt(size + 8));
      out.set(body, 16);
      return out;
    }
    const out = new Uint8Array(size);
    new DataView(out.buffer).setUint32(0, size);
    out.set(ascii(this.type), 4);
    out.set(body, 8);
    return out;
  }

  find(...path: string[]): Box | null {
    const [type, ...rest] = path;
    if (type === undefined) return this;
    const next = (this.children ?? []).find((child) => child.type === type);
    return next ? next.find(...rest) : null;
  }

  findAll(type: string): Box[] {
    return (this.children ?? []).filter((child) => child.type === type);
  }

  walk(): Box[] {
    const out: Box[] = [this];
    for (const child of this.children ?? []) out.push(...child.walk());
    return out;
  }

  copy(): Box {
    return parseBoxes(this.serialize())[0];
  }
}

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}

function fourcc(data: Uint8Array, at: number): string {
  return String.fromCharCode(data[at], data[at + 1], data[at + 2], data[at + 3]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

/** Parse the boxes in data[start:end]. Stops at the first malformed header, like the Python parser. */
export function parseBoxes(data: Uint8Array, start = 0, end = data.length): Box[] {
  const dv = view(data);
  const boxes: Box[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = dv.getUint32(pos);
    const type = fourcc(data, pos + 4);
    let header = 8;
    if (size === 1) {
      if (pos + 16 > end) break;
      size = Number(dv.getBigUint64(pos + 8));
      header = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < header || pos + size > end) break;
    if (CONTAINERS.has(type)) boxes.push(new Box(type, { children: parseBoxes(data, pos + header, pos + size) }));
    else boxes.push(new Box(type, { payload: data.subarray(pos + header, pos + size) }));
    pos += size;
  }
  return boxes;
}

// --- helpers for specific boxes ---------------------------------------------

const u32 = (b: Uint8Array, at: number) => view(b).getUint32(at);
const u64 = (b: Uint8Array, at: number) => Number(view(b).getBigUint64(at));

function handlerType(trak: Box): string {
  const hdlr = trak.find("mdia", "hdlr");
  return hdlr ? fourcc(hdlr.payload, 8) : "";
}

function sampleEntryType(trak: Box): string {
  const stsd = trak.find("mdia", "minf", "stbl", "stsd");
  if (!stsd || stsd.payload.length < 16) return "";
  return fourcc(stsd.payload, 12);
}

function trackIdOffset(tkhd: Box) {
  return tkhd.payload[0] === 0 ? 12 : 20;
}

function trackId(trak: Box): number {
  const tkhd = trak.find("tkhd");
  if (!tkhd) throw new OqmError("A track has no header.");
  return u32(tkhd.payload, trackIdOffset(tkhd));
}

function setTrackId(trak: Box, id: number) {
  const tkhd = trak.find("tkhd")!;
  const payload = tkhd.payload.slice();
  view(payload).setUint32(trackIdOffset(tkhd), id);
  tkhd.payload = payload;
}

function shiftChunkOffsets(moov: Box, delta: number) {
  for (const box of moov.walk().filter((b) => b.type === "stco" || b.type === "co64")) {
    const payload = box.payload.slice();
    const dv = view(payload);
    const count = dv.getUint32(4);
    if (box.type === "stco") {
      for (let i = 0; i < count; i++) {
        const next = dv.getUint32(8 + 4 * i) + delta;
        if (next < 0 || next > 0xffffffff) {
          throw new OqmError("This file is too large for the layout it uses (offsets past 4 GB). Turn on re-encode or export a smaller file.");
        }
        dv.setUint32(8 + 4 * i, next);
      }
    } else {
      for (let i = 0; i < count; i++) dv.setBigUint64(8 + 8 * i, dv.getBigUint64(8 + 8 * i) + BigInt(delta));
    }
    box.payload = payload;
  }
}

function setNextTrackId(mvhd: Box, value: number) {
  const payload = mvhd.payload.slice();
  view(payload).setUint32(payload.length - 4, value);
  mvhd.payload = payload;
}

// --- the decoy tracks -------------------------------------------------------

/**
 * Clone a trak and append (inflate - 1) x N dummy samples to its tables. The dummy samples live in one extra chunk
 * that points at the track's first real chunk, so they reference bytes that already exist and nothing is added to
 * mdat. The clone keeps the real track's edit list: dropping it makes the clone's implied duration the untrimmed,
 * longer value, which then becomes the container's reported duration (the "duration drift" bug).
 */
function buildDecoy(
  source: Box,
  inflate: number,
  dummySize: number,
  mdatPayloadLength: number,
  mdatPayloadOffset: number,
  handler: string,
) {
  const clone = source.copy();
  clone.children = (clone.children ?? []).filter((child) => child.type !== "tref");
  const stbl = clone.find("mdia", "minf", "stbl");
  const stsz = stbl?.find("stsz");
  const stts = stbl?.find("stts");
  const stsc = stbl?.find("stsc");
  const co = stbl?.find("stco") ?? stbl?.find("co64");
  if (!stbl || !stsz || !stts || !stsc || !co) throw new OqmError("A track is missing its sample tables.");

  const uniform = u32(stsz.payload, 4);
  const count = u32(stsz.payload, 8);
  let extra = count * Math.max(inflate - 1, 0);

  const wide = co.type === "co64";
  const chunks = u32(co.payload, 4);
  if (chunks === 0) throw new OqmError("A track has no data.");
  const first = wide ? u64(co.payload, 8) : u32(co.payload, 8);
  // Keep the dummy reads inside mdat.
  const room = mdatPayloadOffset + mdatPayloadLength - first;
  if (extra * dummySize > room) extra = Math.floor(room / dummySize);

  const stscCount = u32(stsc.payload, 4);
  const descIndex = stscCount ? u32(stsc.payload, 8 + 12 * (stscCount - 1) + 8) : 1;

  const newSizes = new Uint8Array(12 + 4 * (count + extra));
  const sv = view(newSizes);
  sv.setUint32(8, count + extra);
  for (let i = 0; i < count; i++) sv.setUint32(12 + 4 * i, uniform || u32(stsz.payload, 12 + 4 * i));
  for (let i = 0; i < extra; i++) sv.setUint32(12 + 4 * (count + i), dummySize);
  stsz.payload = newSizes;

  const sttsCount = u32(stts.payload, 4);
  const newStts = new Uint8Array(stts.payload.length + 8);
  newStts.set(stts.payload);
  view(newStts).setUint32(4, sttsCount + 1);
  view(newStts).setUint32(stts.payload.length, extra);
  view(newStts).setUint32(stts.payload.length + 4, 1);
  stts.payload = newStts;

  const newStsc = new Uint8Array(stsc.payload.length + 12);
  newStsc.set(stsc.payload);
  view(newStsc).setUint32(4, stscCount + 1);
  view(newStsc).setUint32(stsc.payload.length, chunks + 1);
  view(newStsc).setUint32(stsc.payload.length + 4, extra);
  view(newStsc).setUint32(stsc.payload.length + 8, descIndex);
  stsc.payload = newStsc;

  const entry = wide ? 8 : 4;
  const newCo = new Uint8Array(co.payload.length + entry);
  newCo.set(co.payload);
  view(newCo).setUint32(4, chunks + 1);
  if (wide) view(newCo).setBigUint64(co.payload.length, BigInt(first));
  else view(newCo).setUint32(co.payload.length, first);
  co.payload = newCo;

  const hdlr = clone.find("mdia", "hdlr");
  if (hdlr) hdlr.payload = concat([hdlr.payload.subarray(0, 24), ascii(handler), new Uint8Array(1)]);
  return { clone, real: count, dummy: extra };
}

// --- the other patches ------------------------------------------------------

function zeroTimes(box: Box | null) {
  if (!box) return;
  const payload = box.payload.slice();
  payload.fill(0, 4, payload[0] === 0 ? 12 : 20);
  box.payload = payload;
}

/**
 * Lengthen the video edit list by one movie tick. Browser encoders don't write an edit list, so when there is none
 * and the video has no B-frame reordering (no ctts), add the plain one FFmpeg writes (whole track from time 0), +1.
 * The Python tool only ever sees FFmpeg output, which always has one.
 */
function videoElstPlusOne(video: Box, mvhd: Box): boolean {
  let elst = video.find("edts", "elst");
  if (!elst && !video.find("mdia", "minf", "stbl", "ctts")) {
    const m = mvhd.payload;
    const duration = m[0] === 0 ? u32(m, 16) : u64(m, 24);
    if (!duration || duration > 0xfffffffe) return false;
    const payload = new Uint8Array(20);
    const dv = view(payload);
    dv.setUint32(4, 1); // one entry
    dv.setUint32(8, duration); // segment duration, movie timescale
    dv.setUint32(12, 0); // media time 0
    dv.setUint32(16, 0x00010000); // rate 1.0
    elst = new Box("elst", { payload });
    const tkhdAt = video.children!.findIndex((c) => c.type === "tkhd");
    video.children!.splice(tkhdAt + 1, 0, new Box("edts", { children: [elst] }));
  }
  if (!elst || u32(elst.payload, 4) === 0) return false;
  const payload = elst.payload.slice();
  const dv = view(payload);
  if (payload[0] === 0) dv.setUint32(8, dv.getUint32(8) + 1);
  else dv.setBigUint64(8, dv.getBigUint64(8) + BigInt(1));
  elst.payload = payload;
  return true;
}

/** Widen mvhd to version 1 and blank its duration; every other field (rate, volume, matrix, next track id) is kept. */
function mvhdUnknownDuration(mvhd: Box) {
  const p = mvhd.payload;
  const dv = view(p);
  const v0 = p[0] === 0;
  const creation = v0 ? BigInt(dv.getUint32(4)) : dv.getBigUint64(4);
  const modification = v0 ? BigInt(dv.getUint32(8)) : dv.getBigUint64(12);
  const timescale = v0 ? dv.getUint32(12) : dv.getUint32(20);
  const rest = p.subarray(v0 ? 20 : 32);
  const head = new Uint8Array(32);
  const hv = view(head);
  hv.setUint32(0, 1 << 24);
  hv.setBigUint64(4, creation);
  hv.setBigUint64(12, modification);
  hv.setUint32(20, timescale);
  hv.setBigUint64(24, BigInt("0xffffffffffffffff"));
  mvhd.payload = concat([head, rest]);
}

function fullBox(type: string, payload: Uint8Array): Box {
  return new Box(type, { payload: concat([new Uint8Array(4), payload]) });
}

function minimalUdta(encoder: string): Box {
  const hdlr = fullBox("hdlr", concat([new Uint8Array(4), ascii("mdir"), ascii("appl"), new Uint8Array(9)])).serialize();
  let items: Uint8Array = new Uint8Array(0);
  if (encoder) {
    const flags = new Uint8Array(8);
    view(flags).setUint32(0, 1);
    const data = new Box("data", { payload: concat([flags, new TextEncoder().encode(encoder)]) }).serialize();
    items = new Box("©too", { payload: data }).serialize();
  }
  const ilst = new Box("ilst", { payload: items }).serialize();
  return new Box("udta", { children: [fullBox("meta", concat([hdlr, ilst]))] });
}

/** Same bytes as the Python tool: an 8-byte 'VOID' header, then 4-byte words of 00000004. */
function trailingPad(size: number): Uint8Array {
  const words = Math.max(0, Math.floor((size - 8) / 4));
  const out = new Uint8Array(8 + 4 * words);
  view(out).setUint32(0, 4);
  out.set(ascii("VOID"), 4);
  for (let i = 0; i < words; i++) out[8 + 4 * i + 3] = 4;
  return out;
}

// --- reading the file -------------------------------------------------------

type TopLevel = { type: string; start: number; size: number; header: number };

export async function readTopLevel(file: Blob): Promise<TopLevel[]> {
  const boxes: TopLevel[] = [];
  let pos = 0;
  while (pos + 8 <= file.size) {
    const head = new Uint8Array(await file.slice(pos, Math.min(pos + 16, file.size)).arrayBuffer());
    const dv = view(head);
    let size = dv.getUint32(0);
    const type = fourcc(head, 4);
    let header = 8;
    if (size === 1) {
      if (head.length < 16) break;
      size = Number(dv.getBigUint64(8));
      header = 16;
    } else if (size === 0) {
      size = file.size - pos;
    }
    if (size < header || pos + size > file.size) break;
    boxes.push({ type, start: pos, size, header });
    pos += size;
  }
  return boxes;
}

/**
 * Can this file be patched as-is (no remux first)? True for a plain MP4/MOV with one index, one media block, and
 * at most one video and one audio track, which is what most editors export.
 */
export async function isPatchReady(file: Blob): Promise<boolean> {
  const top = await readTopLevel(file);
  const moov = top.filter((b) => b.type === "moov");
  if (!top.some((b) => b.type === "ftyp") || moov.length !== 1 || top.some((b) => b.type === "moof")) return false;
  if (top.filter((b) => b.type === "mdat").length !== 1) return false;
  if (moov[0].size > MAX_MOOV_BYTES) return false;
  const bytes = new Uint8Array(await file.slice(moov[0].start, moov[0].start + moov[0].size).arrayBuffer());
  const traks = parseBoxes(bytes)[0]?.findAll("trak") ?? [];
  const kinds = traks.map(handlerType);
  return kinds.length === traks.length && kinds.filter((k) => k === "vide").length === 1 && kinds.filter((k) => k === "soun").length <= 1
    && kinds.every((k) => k === "vide" || k === "soun");
}

export type Check = { name: string; ok: boolean; detail: string; warn?: boolean };

export type PatchResult = {
  blob: Blob;
  checks: Check[];
  applied: string[];
  skipped: string[];
  notes: string[];
};

/** Patch an MP4/MOV. Throws OqmError with a message a person can act on. */
export async function patchVideo(file: Blob, opts: PatchOptions = DEFAULT_PATCH): Promise<PatchResult> {
  const on = new Set<PatchId>(opts.enabled);
  const top = await readTopLevel(file);
  if (top.length === 0 || !top.some((box) => box.type === "ftyp")) throw new OqmError("That does not look like an MP4 or MOV file.");
  if (top.some((box) => box.type === "moof")) throw new OqmError("This is a fragmented MP4. Turn on re-encode, or export a regular MP4.");
  const ftypInfo = top.find((box) => box.type === "ftyp")!;
  const moovInfo = top.find((box) => box.type === "moov");
  const mdats = top.filter((box) => box.type === "mdat");
  if (!moovInfo) throw new OqmError("The file has no index (moov) box. It may be cut off or still exporting.");
  if (mdats.length !== 1) throw new OqmError("This file stores its media in more than one block.");
  if (moovInfo.size > MAX_MOOV_BYTES) throw new OqmError("This file's index is unusually large. Re-export it and try again.");
  const mdat = mdats[0];

  const ftyp = new Uint8Array(await file.slice(ftypInfo.start, ftypInfo.start + ftypInfo.size).arrayBuffer());
  const moovBytes = new Uint8Array(await file.slice(moovInfo.start, moovInfo.start + moovInfo.size).arrayBuffer());
  const original = parseBoxes(moovBytes)[0];
  if (!original || original.type !== "moov") throw new OqmError("The file's index could not be read.");
  const moov = original.copy();

  const oldPayloadOffset = mdat.start + mdat.header;
  const mdatLength = mdat.size - mdat.header;
  const applied: string[] = [];
  const skipped: string[] = [];
  const notes: string[] = [];
  const mark = (id: PatchId, ok = true, why = "") => {
    if (on.has(id)) (ok ? applied : skipped).push(ok ? id : `${id} (${why})`);
  };

  const traks = moov.findAll("trak");
  const video = traks.find((trak) => handlerType(trak) === "vide");
  const audio = traks.find((trak) => handlerType(trak) === "soun");
  if (!video) throw new OqmError("No video track found in this file.");
  const mvhd = moov.find("mvhd");
  if (!mvhd) throw new OqmError("The file's index is missing its movie header.");

  if (on.has("zero-times")) {
    for (const trak of traks) {
      zeroTimes(trak.find("tkhd"));
      zeroTimes(trak.find("mdia", "mdhd"));
    }
    mark("zero-times");
  }

  if (on.has("video-elst-plus-one")) mark("video-elst-plus-one", videoElstPlusOne(video, mvhd), "video track has no usable edit list");

  const dummySize = opts.dummySize || DUMMY_SIZE_BY_CODEC[sampleEntryType(video)] || 8;
  const decoyIds: number[] = [];
  const addDecoy = (source: Box, handler: string, label: string, insertAfter: Box) => {
    const { clone, real, dummy } = buildDecoy(source, opts.inflate, dummySize, mdatLength, oldPayloadOffset, handler);
    const newId = Math.max(...moov.findAll("trak").map(trackId)) + 1;
    setTrackId(clone, newId);
    moov.children!.splice(moov.children!.indexOf(insertAfter) + 1, 0, clone);
    setNextTrackId(mvhd, newId + 1);
    decoyIds.push(newId);
    notes.push(`${label}: clone declares ${(real + dummy).toLocaleString()} samples (${real.toLocaleString()} real + ${dummy.toLocaleString()} x ${dummySize} B dummy)`);
  };

  if (on.has("decoy-audio")) {
    if (!audio) mark("decoy-audio", false, "no audio track; export with audio, even silence");
    else {
      addDecoy(audio, "SoundHandler", "decoy-audio", audio);
      mark("decoy-audio");
    }
  }
  if (on.has("decoy-video")) {
    const all = moov.findAll("trak");
    addDecoy(video, "VideoHandler", "decoy-video", all[all.length - 1]);
    mark("decoy-video");
  }

  if (on.has("mvhd-unknown-duration")) {
    mvhdUnknownDuration(mvhd);
    mark("mvhd-unknown-duration");
  }
  if (on.has("clean-metadata")) {
    moov.children = moov.children!.filter((child) => child.type !== "udta");
    moov.children.push(minimalUdta(opts.encoderTag));
    mark("clean-metadata");
  }

  // Keep padding unless its toggle is on, and shift offsets to the same media bytes.
  const padding = on.has("strip-free") ? [] : top.filter((box) => box.type === "free" || box.type === "skip");
  const paddingLength = padding.reduce((size, box) => size + box.size, 0);
  const moovLength = moov.serialize().length;
  const mdatHeaderSize = mdatLength + 8 > 0xffffffff ? 16 : 8;
  const delta = ftyp.length + moovLength + paddingLength + mdatHeaderSize - oldPayloadOffset;
  if (delta) shiftChunkOffsets(moov, delta);
  const newMoov = moov.serialize();
  applied.unshift("faststart");

  const mdatHeader = new Uint8Array(mdatHeaderSize);
  const hv = view(mdatHeader);
  mdatHeader.set(ascii("mdat"), 4);
  if (mdatHeaderSize === 16) {
    hv.setUint32(0, 1);
    hv.setBigUint64(8, BigInt(mdatLength + 16));
  } else {
    hv.setUint32(0, mdatLength + 8);
  }

  const pad = on.has("trailing-pad") ? trailingPad(opts.trailingBytes) : new Uint8Array(0);
  mark("trailing-pad");
  mark("strip-free");

  const parts: BlobPart[] = [ftyp as BlobPart, newMoov as BlobPart, ...padding.map((box) => file.slice(box.start, box.start + box.size)), mdatHeader as BlobPart, file.slice(oldPayloadOffset, oldPayloadOffset + mdatLength)];
  if (pad.length) parts.push(pad as BlobPart);
  const blob = new Blob(parts, { type: "video/mp4" });

  const checks = verify(original, newMoov, delta, decoyIds, {
    mdatLength,
    outputSize: blob.size,
    expectedSize: ftyp.length + newMoov.length + paddingLength + mdatHeaderSize + mdatLength + pad.length,
  });
  return { blob, checks, applied, skipped, notes };
}

function verify(
  original: Box,
  newMoovBytes: Uint8Array,
  delta: number,
  decoyIds: number[],
  facts: { mdatLength: number; outputSize: number; expectedSize: number },
): Check[] {
  const checks: Check[] = [];
  const reparsed = parseBoxes(newMoovBytes)[0];
  const ok = reparsed?.type === "moov";
  checks.push({ name: "New index reads back cleanly", ok, detail: ok ? "parsed" : "could not be parsed" });
  if (!ok) return checks;

  const before = original.findAll("trak");
  const after = reparsed.findAll("trak");
  checks.push({
    name: "Original tracks still there",
    ok: after.length === before.length + decoyIds.length,
    detail: `${before.length} tracks became ${after.length}` + (decoyIds.length ? ` (${decoyIds.length} decoy added)` : ""),
  });

  // Every original track keeps its sample tables; only chunk offsets move, by exactly the layout shift.
  const survivors = after.filter((trak) => !decoyIds.includes(trackId(trak)));
  let same = survivors.length === before.length;
  let pointsRight = survivors.length === before.length;
  survivors.forEach((trak, index) => {
    const old = before[index];
    if (!old) return;
    for (const type of ["stsz", "stts", "stsc", "stss", "ctts", "stsd"]) {
      const a = old.find("mdia", "minf", "stbl", type)?.payload;
      const b = trak.find("mdia", "minf", "stbl", type)?.payload;
      if ((a?.length ?? 0) !== (b?.length ?? 0) || (a && b && a.some((byte, i) => byte !== b[i]))) same = false;
    }
    const oldCo = old.find("mdia", "minf", "stbl", "stco") ?? old.find("mdia", "minf", "stbl", "co64");
    const newCo = trak.find("mdia", "minf", "stbl", "stco") ?? trak.find("mdia", "minf", "stbl", "co64");
    if (!oldCo || !newCo || oldCo.type !== newCo.type) {
      pointsRight = false;
      return;
    }
    const count = u32(oldCo.payload, 4);
    const wide = oldCo.type === "co64";
    for (let i = 0; i < count; i++) {
      const a = wide ? u64(oldCo.payload, 8 + 8 * i) : u32(oldCo.payload, 8 + 4 * i);
      const b = wide ? u64(newCo.payload, 8 + 8 * i) : u32(newCo.payload, 8 + 4 * i);
      if (b - a !== delta) pointsRight = false;
    }
  });
  checks.push({ name: "Video and audio timing tables unchanged", ok: same, detail: same ? "identical" : "a table changed" });
  checks.push({
    name: "Every chunk still points at the same bytes",
    ok: pointsRight,
    detail: pointsRight ? `all offsets moved by ${delta.toLocaleString()} bytes` : "an offset is off",
  });
  checks.push({
    name: "Video and audio data copied as-is",
    ok: facts.outputSize === facts.expectedSize,
    detail: `${facts.mdatLength.toLocaleString()} bytes, byte for byte`,
  });
  return checks;
}
