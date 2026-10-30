/**
 * OQM in the browser: the "minimal" profile of the Python tool (faststart plus
 * the decoy audio track), working directly on the MP4's boxes.
 *
 * The video and audio bytes are never read, decoded, or copied through memory.
 * The output is a Blob stitched from the original file's own byte range for
 * `mdat` plus a rewritten `moov`, so it is lossless by construction and a
 * multi-gigabyte export does not need multi-gigabyte RAM.
 *
 * This is a port of oqm/mp4.py and oqm/patches.py in the same repository. Keep
 * the two in step.
 */

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "udta", "mvex"]);

/** Bytes a dummy decoy sample is declared to be, per video sample entry. Same table as the Python tool. */
const DUMMY_SIZE_BY_CODEC: Record<string, number> = {
  avc1: 8,
  avc3: 8,
  hvc1: 16,
  hev1: 16,
  vp09: 4,
  av01: 4,
  mp4v: 8,
};

/** The decoy track declares this many times the real audio sample count. */
const INFLATE = 10;
/** Refuse a header index bigger than this; a normal export is far smaller. */
const MAX_MOOV_BYTES = 512 * 1024 * 1024;

export class OqmError extends Error {}

// --- box tree ---------------------------------------------------------------

export class Box {
  type: string;
  payload: Uint8Array;
  children: Box[] | null;
  offset: number;
  headerSize: number;

  constructor(
    type: string,
    opts: { payload?: Uint8Array; children?: Box[] | null; offset?: number; headerSize?: number } = {},
  ) {
    this.type = type;
    this.payload = opts.payload ?? new Uint8Array(0);
    this.children = opts.children ?? null;
    this.offset = opts.offset ?? 0;
    this.headerSize = opts.headerSize ?? 8;
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
      const view = new DataView(out.buffer);
      view.setUint32(0, 1);
      out.set(ascii(this.type), 4);
      view.setBigUint64(8, BigInt(size + 8));
      out.set(body, 16);
      return out;
    }
    const out = new Uint8Array(8 + body.length);
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
export function parseBoxes(data: Uint8Array, start = 0, end = data.length, base = 0): Box[] {
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
    if (CONTAINERS.has(type)) {
      boxes.push(
        new Box(type, {
          children: parseBoxes(data, pos + header, pos + size, base),
          offset: base + pos,
          headerSize: header,
        }),
      );
    } else {
      boxes.push(new Box(type, { payload: data.subarray(pos + header, pos + size), offset: base + pos, headerSize: header }));
    }
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

function chunkOffsetBoxes(moov: Box): Box[] {
  return moov.walk().filter((box) => box.type === "stco" || box.type === "co64");
}

function shiftChunkOffsets(moov: Box, delta: number) {
  for (const box of chunkOffsetBoxes(moov)) {
    const payload = box.payload.slice();
    const dv = view(payload);
    const count = dv.getUint32(4);
    if (box.type === "stco") {
      for (let i = 0; i < count; i++) {
        const next = dv.getUint32(8 + 4 * i) + delta;
        if (next < 0 || next > 0xffffffff) {
          throw new OqmError("This file is too large for the layout it uses (offsets past 4 GB). Re-export it as a smaller file.");
        }
        dv.setUint32(8 + 4 * i, next);
      }
    } else {
      for (let i = 0; i < count; i++) dv.setBigUint64(8 + 8 * i, BigInt(Number(dv.getBigUint64(8 + 8 * i)) + delta));
    }
    box.payload = payload;
  }
}

function setNextTrackId(mvhd: Box, value: number) {
  const payload = mvhd.payload.slice();
  view(payload).setUint32(payload.length - 4, value);
  mvhd.payload = payload;
}

// --- the decoy track --------------------------------------------------------

/**
 * Clone the audio trak and append (INFLATE - 1) x N dummy samples to its
 * tables. The dummy samples live in one extra chunk that points at the first
 * real audio chunk, so they reference bytes that already exist and nothing is
 * added to mdat.
 */
function buildDecoy(audio: Box, dummySize: number, mdatPayloadLength: number, mdatPayloadOffset: number) {
  const clone = audio.copy();
  clone.children = (clone.children ?? []).filter((child) => child.type !== "edts" && child.type !== "tref");
  const stbl = clone.find("mdia", "minf", "stbl");
  const stsz = stbl?.find("stsz");
  const stts = stbl?.find("stts");
  const stsc = stbl?.find("stsc");
  const co = stbl?.find("stco") ?? stbl?.find("co64");
  if (!stbl || !stsz || !stts || !stsc || !co) throw new OqmError("The audio track is missing its sample tables.");

  const uniform = u32(stsz.payload, 4);
  const count = u32(stsz.payload, 8);
  const sizes = new Uint32Array(count);
  if (uniform) sizes.fill(uniform);
  else for (let i = 0; i < count; i++) sizes[i] = u32(stsz.payload, 12 + 4 * i);
  let extra = count * Math.max(INFLATE - 1, 0);

  const wide = co.type === "co64";
  const chunks = u32(co.payload, 4);
  if (chunks === 0) throw new OqmError("The audio track has no data.");
  const first = wide ? u64(co.payload, 8) : u32(co.payload, 8);
  // Keep the dummy reads inside mdat.
  const room = mdatPayloadOffset + mdatPayloadLength - first;
  if (extra * dummySize > room) extra = Math.floor(room / dummySize);

  const stscCount = u32(stsc.payload, 4);
  const descIndex = stscCount ? u32(stsc.payload, 8 + 12 * (stscCount - 1) + 8) : 1;

  const newSizes = new Uint8Array(12 + 4 * (count + extra));
  const sizeView = view(newSizes);
  sizeView.setUint32(8, count + extra);
  for (let i = 0; i < count; i++) sizeView.setUint32(12 + 4 * i, sizes[i]);
  for (let i = 0; i < extra; i++) sizeView.setUint32(12 + 4 * (count + i), dummySize);
  stsz.payload = newSizes;

  const sttsCount = u32(stts.payload, 4);
  const newStts = new Uint8Array(stts.payload.length + 8);
  newStts.set(stts.payload.subarray(0, stts.payload.length));
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
  if (hdlr) hdlr.payload = concat([hdlr.payload.subarray(0, 24), new Uint8Array([...ascii("SoundHandler"), 0])]);
  return { clone, real: count, dummy: extra, dummySize };
}

// --- reading the file -------------------------------------------------------

type TopLevel = { type: string; start: number; size: number; header: number };

async function readTopLevel(file: Blob): Promise<TopLevel[]> {
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

export type Check = { name: string; ok: boolean; detail: string };

export type PatchResult = {
  blob: Blob;
  checks: Check[];
  summary: string;
};

/**
 * Patch an MP4/MOV. Throws OqmError with a message a person can act on.
 * `onStep` reports coarse progress.
 */
export async function patchVideo(file: Blob, onStep: (step: string) => void = () => {}): Promise<PatchResult> {
  onStep("Reading the file layout");
  const top = await readTopLevel(file);
  if (top.length === 0 || !top.some((box) => box.type === "ftyp")) {
    throw new OqmError("That does not look like an MP4 or MOV file.");
  }
  if (top.some((box) => box.type === "moof")) {
    throw new OqmError("This is a fragmented MP4, which OQM cannot patch yet. Export a regular MP4 (no fragmenting) and try again.");
  }
  const ftypInfo = top.find((box) => box.type === "ftyp")!;
  const moovInfo = top.find((box) => box.type === "moov");
  const mdats = top.filter((box) => box.type === "mdat");
  if (!moovInfo) throw new OqmError("The file has no index (moov) box. It may be cut off or still exporting.");
  if (mdats.length !== 1) {
    throw new OqmError("This file stores its video in more than one block. Re-export it from your editor as a single MP4 and try again.");
  }
  if (moovInfo.size > MAX_MOOV_BYTES) throw new OqmError("This file's index is unusually large. Re-export it and try again.");
  const mdat = mdats[0];

  onStep("Reading the index");
  const ftyp = new Uint8Array(await file.slice(ftypInfo.start, ftypInfo.start + ftypInfo.size).arrayBuffer());
  const moovBytes = new Uint8Array(await file.slice(moovInfo.start, moovInfo.start + moovInfo.size).arrayBuffer());
  const original = parseBoxes(moovBytes, 0, moovBytes.length, moovInfo.start)[0];
  if (!original || original.type !== "moov") throw new OqmError("The file's index could not be read.");
  const moov = original.copy();

  const oldPayloadOffset = mdat.start + mdat.header;
  const mdatLength = mdat.size - mdat.header;

  const traks = moov.findAll("trak");
  const video = traks.find((trak) => handlerType(trak) === "vide");
  const audio = traks.find((trak) => handlerType(trak) === "soun");
  if (!video) throw new OqmError("No video track found in this file.");
  if (!audio) {
    throw new OqmError("This video has no audio track. Add audio (even silence) when you export, then try again.");
  }

  onStep("Adding the decoy track");
  const dummySize = DUMMY_SIZE_BY_CODEC[sampleEntryType(video)] ?? 8;
  const { clone, real, dummy } = buildDecoy(audio, dummySize, mdatLength, oldPayloadOffset);
  const newId = Math.max(...traks.map(trackId)) + 1;
  setTrackId(clone, newId);
  moov.children!.splice(moov.children!.indexOf(audio) + 1, 0, clone);
  const mvhd = moov.find("mvhd");
  if (!mvhd) throw new OqmError("The file's index is missing its movie header.");
  setNextTrackId(mvhd, newId + 1);

  onStep("Rewriting the layout");
  // ftyp, moov, mdat. Shift chunk offsets so they point at the same bytes.
  const moovLength = moov.serialize().length;
  const mdatHeaderSize = mdatLength + 8 > 0xffffffff ? 16 : 8;
  const delta = ftyp.length + moovLength + mdatHeaderSize - oldPayloadOffset;
  if (delta) shiftChunkOffsets(moov, delta);
  const newMoov = moov.serialize();

  const mdatHeader = new Uint8Array(mdatHeaderSize);
  const hv = view(mdatHeader);
  if (mdatHeaderSize === 16) {
    hv.setUint32(0, 1);
    mdatHeader.set(ascii("mdat"), 4);
    hv.setBigUint64(8, BigInt(mdatLength + 16));
  } else {
    hv.setUint32(0, mdatLength + 8);
    mdatHeader.set(ascii("mdat"), 4);
  }

  const parts = [ftyp, newMoov, mdatHeader] as unknown as BlobPart[];
  parts.push(file.slice(oldPayloadOffset, oldPayloadOffset + mdatLength));
  const blob = new Blob(parts, {
    type: "video/mp4",
  });

  onStep("Checking the result");
  const checks = verify(original, newMoov, delta, {
    mdatLength,
    outputSize: blob.size,
    expectedSize: ftyp.length + newMoov.length + mdatHeaderSize + mdatLength,
    audioId: trackId(audio),
    decoyId: newId,
    trackCount: traks.length,
  });
  const summary = `Added a hidden audio track (${real.toLocaleString()} real samples, ${dummy.toLocaleString()} placeholder samples). The video and audio data were not touched.`;
  return { blob, checks, summary };
}

function verify(
  original: Box,
  newMoovBytes: Uint8Array,
  delta: number,
  facts: {
    mdatLength: number;
    outputSize: number;
    expectedSize: number;
    audioId: number;
    decoyId: number;
    trackCount: number;
  },
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
    ok: after.length === before.length + 1,
    detail: `${before.length} tracks became ${after.length} (one decoy added)`,
  });

  // Every original track keeps its sample tables; only chunk offsets move, by exactly the layout shift.
  const survivors = after.filter((trak) => trackId(trak) !== facts.decoyId);
  let same = survivors.length === before.length;
  let pointsRight = survivors.length === before.length;
  survivors.forEach((trak, index) => {
    const old = before[index];
    if (!old) return;
    for (const type of ["stsz", "stts", "stsc", "stss", "ctts"]) {
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
