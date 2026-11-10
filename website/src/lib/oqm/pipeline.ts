/**
 * The whole conversion, in the browser: optional clean re-encode (WebCodecs, through Mediabunny), then the
 * container patches from ./patch, then a read-back check. Mirrors the desktop app's `make` flow and lab mode.
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeVideo,
} from "mediabunny";
import { ALL_PATCHES, DEFAULT_PATCH, OqmError, REFERENCE, isPatchReady, patchVideo, type Check, type PatchOptions } from "./patch";

import { silentTail } from "./silentTail";

export type SizeMode = "original" | "short-720" | "short-1080" | "short-1440" | "short-2160";
export type RateMode = "quantizer" | "bitrate" | "very-high" | "high";

export type EncodeOptions = {
  reencode: boolean;
  codec: "avc" | "hevc";
  rate: RateMode;
  /** Like FFmpeg's CRF: lower is better. 0-51. */
  quantizer: number;
  /** Used when rate = "bitrate", quantizer fallback uses a size/frame-rate estimate. */
  mbps: number;
  size: SizeMode;
  /** null preserves timing; source-max-60 caps high-rate sources without duplicating lower-rate frames. */
  fps: number | "source-max-60" | null;
  /** Seconds between keyframes. 0 = one keyframe at the start only (long GOP, like the reference tool). */
  keyframeSec: number;
  audioKbps: number;
  hardware: "no-preference" | "prefer-hardware" | "prefer-software";
};

export type Recipe = { method?: "legacy" | "silent-tail"; encode: EncodeOptions; patch: PatchOptions };

export const DEFAULT_ENCODE: EncodeOptions = {
  reencode: true,
  codec: "avc",
  rate: "quantizer",
  quantizer: 17,
  mbps: 20,
  size: "original",
  fps: null,
  keyframeSec: 2,
  audioKbps: 320,
  hardware: "no-preference",
};

/** What the desktop app does: clean H.264 re-encode at quality 17, same size and frame rate, full patch set. */
export const DEFAULT_RECIPE: Recipe = { encode: DEFAULT_ENCODE, patch: DEFAULT_PATCH };

export type Preset = { id: string; title: string; desc: string; recipe: Recipe };

const withPatches = (enabled: PatchOptions["enabled"], encode: Partial<EncodeOptions> = {}): Recipe => ({
  encode: { ...DEFAULT_ENCODE, ...encode },
  patch: { ...DEFAULT_PATCH, enabled },
});

/** Independent options. The controlled comparison below uses only three shared-source arms. */
export const PRESETS: Preset[] = [
  { id: "current", title: "Current OQM (default)", desc: "Clean H.264 re-encode (quality 17) + full patch set. What the desktop app did.", recipe: DEFAULT_RECIPE },
  { id: "1080p", title: "1080p — high quality", desc: "H.264 at a target 20 Mbps, up to 1080p and 60 fps, AAC audio. Keeps lower source frame rates and dimensions. Current OQM patches; TikTok retention still needs testing.", recipe: withPatches(REFERENCE, { reencode: true, rate: "bitrate", mbps: 20, size: "short-1080", fps: "source-max-60" }) },
  { id: "4k", title: "4K — experimental", desc: "H.264 at a target 60 Mbps, up to 2160p and 60 fps, AAC audio. Use a 4K SDR source; smaller videos stay smaller. Requires a capable browser/device. TikTok may downscale it.", recipe: withPatches(REFERENCE, { reencode: true, rate: "bitrate", mbps: 60, size: "short-2160", fps: "source-max-60" }) },
  { id: "silent-tail", title: "Silent-tail (experimental)", desc: "Keeps video packets, adds a short AAC silence tail and a second audio track. Requires a clean AAC-LC stereo MP4. TikTok results unverified.", recipe: { ...withPatches([], { reencode: false }), method: "silent-tail" } },
  { id: "noreencode", title: "No re-encode", desc: "Your video and audio are kept exactly as they are; only the container is patched.", recipe: withPatches(REFERENCE, { reencode: false }) },
  { id: "longgop", title: "Long keyframe gap", desc: "Re-encode with one keyframe at the start, like the public reference tool, + full patch set.", recipe: withPatches(REFERENCE, { keyframeSec: 0 }) },
  { id: "videodecoy", title: "Full patch + video decoy", desc: "Current patches plus a hidden duplicate video track. Experimental; differs from NoBlur's primary-track inflation.", recipe: withPatches(ALL_PATCHES) },
  { id: "minimal", title: "Decoy only", desc: "Re-encode + just the decoy audio track. Shows whether the other patches matter.", recipe: withPatches(["faststart", "decoy-audio"]) },
  { id: "control", title: "Control: no patch", desc: "Same re-encode, normal container. If this does as well as the others, the patch isn't doing anything.", recipe: withPatches(["faststart"]) },
];

export type Stage = { label: string; progress: number | null };

export type ConvertResult = {
  blob: Blob;
  checks: Check[];
  applied: string[];
  skipped: string[];
  notes: string[];
  info: { width: number; height: number; fps: number; codec: string; mbps: number; duration: number; reencoded: boolean };
};

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

type Probe = { width: number; height: number; fps: number; duration: number; codec: string; packets: number; hasAudio: boolean; channels: number; mbps: number; hdr: boolean };

async function probe(blob: Blob): Promise<Probe> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new OqmError("No video track found in this file.");
    const stats = await video.computePacketStats();
    const audio = await input.getPrimaryAudioTrack();
    return {
      width: video.displayWidth,
      height: video.displayHeight,
      fps: stats.averagePacketRate,
      duration: await video.computeDuration(),
      codec: (await video.getCodecParameterString()) ?? video.codec ?? "unknown",
      packets: stats.packetCount,
      hasAudio: !!audio,
      channels: audio?.numberOfChannels ?? 0,
      mbps: stats.averageBitrate / 1e6,
      hdr: ["pq", "hlg", "smpte2084", "arib-std-b67"].includes((await video.getColorSpace()).transfer ?? "")
        || String((await video.getColorSpace()).primaries) === "bt2020",
    };
  } catch (error) {
    if (error instanceof OqmError) throw error;
    throw new OqmError("This file couldn't be read as a video. Try an MP4 or MOV export.");
  } finally {
    input.dispose();
  }
}

export function targetSize(src: Pick<Probe, "width" | "height">, mode: SizeMode): { width?: number; height?: number } {
  if (mode === "original") return {};
  const target = Number(mode.split("-")[1]);
  const short = Math.min(src.width, src.height);
  if (short <= target) return {};
  const scale = target / short;
  return { width: even(src.width * scale), height: even(src.height * scale) };
}

export function targetFrameRate(sourceFps: number, mode: EncodeOptions["fps"]): number | undefined {
  if (mode === "source-max-60") return sourceFps > 60 ? 60 : undefined;
  return mode ?? undefined;
}

function quality(e: EncodeOptions, width: number, height: number, fps: number): Quality {
  // Bitrate fallback for browsers without quantizer encoding: ~0.25 bits per pixel per frame, capped at 40 Mbps.
  const fallback = Math.min(40e6, Math.round(width * height * fps * 0.25));
  if (e.rate === "quantizer") return new Quality({ quantizer: e.quantizer, bitrate: fallback });
  if (e.rate === "bitrate") return new Quality({ bitrate: Math.round(e.mbps * 1e6) });
  return new Quality(e.rate);
}

async function runConversion(conversion: Conversion, onStage: (s: Stage) => void, label: string, signal?: AbortSignal) {
  if (signal?.aborted) {
    await conversion.cancel();
    throw new OqmError("Stopped.");
  }
  const discarded = conversion.discardedTracks.filter((d) => d.track.type === "video" || d.track.type === "audio");
  if (!conversion.isValid || discarded.length) {
    const why = discarded.map((d) => `${d.track.type}: ${d.reason.replace(/_/g, " ")}`).join(", ");
    throw new OqmError(`This browser can't convert that file (${why}). Try Chrome, or a different export.`);
  }
  const abort = () => void conversion.cancel().catch(() => {});
  signal?.addEventListener("abort", abort);
  conversion.onProgress = (p) => onStage({ label, progress: p });
  try {
    await conversion.execute();
    if (signal?.aborted) throw new OqmError("Stopped.");
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}

/** Chrome's AAC encoder fails intermittently above ~160 kbps per channel (mono at 320 kbps errors out), so cap it. */
const audioBitrate = (kbps: number, channels: number) => Math.min(kbps, 160 * Math.max(1, Math.min(channels, 2))) * 1000;

async function reencode(file: Blob, src: Probe, e: EncodeOptions, onStage: (s: Stage) => void, signal?: AbortSignal) {
  try {
    return await reencodeOnce(file, src, e, audioBitrate(e.audioKbps, src.channels), onStage, signal);
  } catch (error) {
    // One retry at a safe audio bitrate if the browser's audio encoder gave up mid-way.
    if (signal?.aborted || error instanceof OqmError || !/encod/i.test(String(error)) || !src.hasAudio) throw error;
    return await reencodeOnce(file, src, e, 128_000 * Math.max(1, Math.min(src.channels, 2)), onStage, signal);
  }
}

async function reencodeOnce(file: Blob, src: Probe, e: EncodeOptions, audioBps: number, onStage: (s: Stage) => void, signal?: AbortSignal) {
  if (src.hdr) throw new OqmError("HDR/wide-gamut re-encoding needs explicit colour conversion. Use an SDR master; test HDR separately.");
  if (typeof VideoEncoder === "undefined") {
    throw new OqmError("This browser can't encode video. Use a recent Chrome, Edge or Safari, or turn off re-encode in the options.");
  }
  const size = targetSize(src, e.size);
  const width = size.width ?? src.width;
  const height = size.height ?? src.height;
  const frameRate = targetFrameRate(src.fps, e.fps);
  const fps = frameRate ?? src.fps;
  const videoQuality = quality(e, width, height, fps);
  if (!(await canEncodeVideo(e.codec, { width, height, frameRate: fps, quality: videoQuality }))) {
    throw new OqmError(`This browser can't encode ${e.codec === "hevc" ? "H.265" : "H.264"} at ${width}x${height}, ${fps.toFixed(2)} fps with these settings. Try the 1080p preset or a lower bitrate.`);
  }
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  try {
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      video: {
        codec: e.codec,
        quality: videoQuality,
        ...size,
        fit: size.width ? "contain" : undefined,
        frameRate,
        // 0 = long GOP: the reference tool's 9999 frames, which is one keyframe for any TikTok-length clip.
        keyFrameInterval: e.keyframeSec > 0 ? e.keyframeSec : 9999 / fps,
        hardwareAcceleration: e.hardware,
        forceTranscode: true,
      },
      audio: { codec: "aac", bitrate: audioBps, sampleRate: 48000, forceTranscode: true },
      // The desktop app strips metadata on export (-map_metadata -1).
      tags: () => ({}),
    });
    await runConversion(conversion, onStage, "Re-encoding", signal);
  } finally {
    input.dispose();
  }
  return new Blob([output.target.buffer!], { type: "video/mp4" });
}

/** Stream-copy the primary video + audio into a clean MP4. Only used when the file isn't patchable as-is. */
async function remux(file: Blob, onStage: (s: Stage) => void, signal?: AbortSignal) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  try {
    const conversion = await Conversion.init({ input, output, tracks: "primary", copy: { mode: "forced" }, showWarnings: false });
    if (conversion.discardedTracks.some((d) => d.track.type === "video")) {
      throw new OqmError("This video's format can't be kept as-is in an MP4. Turn on re-encode in the options.");
    }
    await runConversion(conversion, onStage, "Repackaging", signal);
  } finally {
    input.dispose();
  }
  return new Blob([output.target.buffer!], { type: "video/mp4" });
}

export async function convert(
  file: File,
  recipe: Recipe,
  onStage: (s: Stage) => void = () => {},
  signal?: AbortSignal,
): Promise<ConvertResult> {
  if (signal?.aborted) throw new OqmError("Stopped.");
  onStage({ label: "Reading your video", progress: null });
  const src = await probe(file);
  if (signal?.aborted) throw new OqmError("Stopped.");

  let base: Blob = file;
  if (recipe.encode.reencode) base = await reencode(file, src, recipe.encode, onStage, signal);
  else if (!(await isPatchReady(file))) base = await remux(file, onStage, signal);
  if (signal?.aborted) throw new OqmError("Stopped.");

  onStage({ label: "Applying the patch", progress: null });
  const result = recipe.method === "silent-tail" ? await silentTail(base) : await patchVideo(base, recipe.patch);
  if (signal?.aborted) throw new OqmError("Stopped.");

  onStage({ label: "Checking the result", progress: null });
  const before = base === file ? src : await probe(base);
  const after = await probe(result.blob);
  if (signal?.aborted) throw new OqmError("Stopped.");
  const frame = before.fps ? 1 / before.fps : 0.05;
  const checks: Check[] = [
    ...result.checks,
    { name: "Video dimensions unchanged by patch", ok: after.width === before.width && after.height === before.height, detail: `${before.width}x${before.height} -> ${after.width}x${after.height}` },
    { name: "Video frame rate unchanged by patch", ok: Math.abs(after.fps - before.fps) < 0.01, detail: `${before.fps.toFixed(3)} -> ${after.fps.toFixed(3)} fps` },
    { name: "Same number of video packets", ok: after.packets === before.packets, detail: `${before.packets} -> ${after.packets}` },
    {
      name: "Video duration within 1 frame",
      ok: Math.abs(after.duration - before.duration) <= frame + 1e-3,
      detail: `${before.duration.toFixed(3)}s -> ${after.duration.toFixed(3)}s`,
    },
  ];
  if (recipe.method !== "silent-tail" && recipe.patch.enabled.includes("decoy-audio") && !before.hasAudio) {
    checks.push({ name: "Decoy audio track", ok: false, warn: true, detail: "skipped: the video has no audio" });
  }
  checks.push({ name: "Audio track preserved", ok: after.hasAudio === before.hasAudio, detail: before.hasAudio ? "audio present" : "source has no audio" });
  return {
    ...result,
    checks,
    info: {
      width: after.width,
      height: after.height,
      fps: after.fps,
      codec: after.codec,
      mbps: after.mbps,
      duration: after.duration,
      reencoded: recipe.encode.reencode,
    },
  };
}

/** Prepare once, then use these identical encoded packets for all comparison arms. */
export async function prepareComparison(file: File, encode: EncodeOptions, onStage: (s: Stage) => void, signal?: AbortSignal): Promise<File> {
  const src = await probe(file);
  if (src.hdr) throw new OqmError("Use an SDR master. HDR is a separate test.");
  const base = encode.reencode ? await reencode(file, src, encode, onStage, signal) : await remux(file, onStage, signal);
  if (signal?.aborted) throw new OqmError("Stopped.");
  return new File([base], file.name.replace(/\.[^.]+$/, "") + "_shared.mp4", { type: "video/mp4" });
}
export const COMPARISON_PRESETS: Preset[] = [
  { id: "clean", title: "A: Clean MP4", desc: "Shared encoded source, normal container.", recipe: withPatches(["faststart"], { reencode: false }) },
  { id: "current", title: "B: Current OQM", desc: "Shared encoded source, current full patch set.", recipe: withPatches(REFERENCE, { reencode: false }) },
  { id: "silent-tail", title: "C: Silent-tail", desc: "Shared encoded source, experimental silent-tail only.", recipe: { ...withPatches([], { reencode: false }), method: "silent-tail" } },
];
export { OqmError };
