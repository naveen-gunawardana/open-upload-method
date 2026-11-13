import type { ConvertResult, Recipe } from "./oqm/pipeline";

const EVENTS = ["started", "succeeded", "check_failed", "failed", "cancelled", "downloaded"] as const;
export type AnalyticsEvent = typeof EVENTS[number];
const PRESETS = ["silent-tail", "current", "1080p", "4k", "noreencode", "longgop", "videodecoy", "minimal", "control", "clean", "custom"];
const PATCHES = ["faststart", "strip-free", "zero-times", "mvhd-unknown-duration", "video-elst-plus-one", "decoy-audio", "decoy-video", "clean-metadata", "trailing-pad"];
const FAILURES = ["decode", "encode", "hdr", "input", "silent-tail", "other"];
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const choice = (v: unknown, options: readonly unknown[]) => options.includes(v) ? v : undefined;
const number = (v: unknown, max: number) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined;
const boolean = (v: unknown) => typeof v === "boolean" ? v : undefined;

const CAMPAIGN_VALUES = {
  source: ["reddit", "github", "guide", "editor-community"],
  medium: ["community", "organic", "referral"],
  campaign: ["editor_launch"],
  content: ["settings-guide", "blurry-guide", "fps-guide", "browser-guide", "measurement-guide", "aftereffects", "videoediting", "tiktokhelp", "mov-guide", "quality-guide", "silent-tail-guide", "github-readme", "launch-post", "resource-reply"],
};

export function sanitizeAttribution(value: unknown) {
  const v = object(value);
  const clean = Object.fromEntries(Object.entries(CAMPAIGN_VALUES)
    .flatMap(([key, options]) => options.includes(v[key] as string) ? [[key, v[key]]] : []));
  return Object.keys(clean).length ? clean : undefined;
}

function currentAttribution() {
  try {
    const query = new URLSearchParams(window.location.search);
    return sanitizeAttribution(Object.fromEntries(Object.keys(CAMPAIGN_VALUES).map(key => [key, query.get(`utm_${key}`)])));
  } catch { return undefined; }
}

function encodeSettings(value: unknown) {
  const e = object(value);
  return {
    reencode: boolean(e.reencode), codec: choice(e.codec, ["avc", "hevc"]),
    rate: choice(e.rate, ["quantizer", "bitrate", "very-high", "high"]),
    quantizer: number(e.quantizer, 63), mbps: number(e.mbps, 1000),
    size: choice(e.size, ["original", "short-720", "short-1080", "short-1440", "short-2160"]),
    fps: e.fps === null ? null : e.fps === "source-max-60" ? e.fps : number(e.fps, 240),
    keyframeSec: number(e.keyframeSec, 10000), audioKbps: number(e.audioKbps, 1536),
    hardware: choice(e.hardware, ["no-preference", "prefer-hardware", "prefer-software"]),
  };
}

/** Rebuild every nested object: filenames, raw errors, IPs and arbitrary extra fields never enter storage. */
export function sanitizeAnalytics(value: unknown) {
  const v = object(value), r = object(v.settings), p = object(r.patch), source = object(v.source), result = object(v.result);
  if (typeof v.run_id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.run_id) || !choice(v.event, EVENTS)) return null;
  return {
    run_id: v.run_id, event: v.event as AnalyticsEvent,
    mode: choice(v.mode, ["single", "ab"]) ?? "single", preset: choice(v.preset, PRESETS) ?? "custom",
    settings: { method: r.method === "silent-tail" ? "silent-tail" : "legacy", encode: encodeSettings(r.encode),
      ...(sanitizeAttribution(v.attribution ?? r.attribution) ? { attribution: sanitizeAttribution(v.attribution ?? r.attribution) } : {}),
      patch: { enabled: Array.isArray(p.enabled) ? [...new Set(p.enabled.filter(x => PATCHES.includes(x)))].slice(0, 9) : [],
        inflate: number(p.inflate, 1000), dummySize: p.dummySize === null ? null : number(p.dummySize, 100000), trailingBytes: number(p.trailingBytes, 100000000) },
      ...((v.shared_encode ?? r.shared_encode) ? { shared_encode: encodeSettings(v.shared_encode ?? r.shared_encode) } : {}) },
    source: { container: choice(source.container, ["mp4", "mov", "m4v", "webm", "mkv", "avi"]) ?? "other", size_mb: number(source.size_mb, 200000) },
    result: v.result ? { width: number(result.width, 32768), height: number(result.height, 32768), fps: number(result.fps, 1000),
      mbps: number(result.mbps, 10000), duration: number(result.duration, 604800), size_mb: number(result.size_mb, 200000),
      codec: choice(result.codec, ["avc", "hevc", "vp9", "av1", "other"]), warnings: number(result.warnings, 1000), failed_checks: number(result.failed_checks, 1000) } : null,
    elapsed_ms: number(v.elapsed_ms, 604800000) ?? null,
    failure_category: choice(v.failure_category, FAILURES) ?? null,
  };
}

export function failureCategory(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/HDR|wide.gamut/i.test(message)) return "hdr";
  if (/decod/i.test(message)) return "decode";
  if (/encod/i.test(message)) return "encode";
  if (/AAC.LC|stereo|silent.tail/i.test(message)) return "silent-tail";
  if (/read|invalid|no video|MP4 or MOV/i.test(message)) return "input";
  return "other";
}

export function clientEnvironment(ua: string) {
  return { browser: /Edg\//.test(ua) ? "edge" : /Firefox\//.test(ua) ? "firefox" : /Chrome\//.test(ua) ? "chrome" : /Safari\//.test(ua) ? "safari" : "other",
    os: /Android/.test(ua) ? "android" : /iPhone|iPad/.test(ua) ? "ios" : /Windows/.test(ua) ? "windows" : /Macintosh/.test(ua) ? "macos" : /Linux/.test(ua) ? "linux" : "other" };
}

export function analyticsRunId() {
  try { return crypto.randomUUID(); } catch { return ""; }
}

type TrackedRun = { analyticsId: string; file: File; recipe: Recipe; comparisonEncode?: Recipe["encode"]; result?: ConvertResult };
export function trackConversion(run: TrackedRun, event: AnalyticsEvent, preset: string, elapsed?: number, error?: unknown) {
  // Analytics is best effort and cannot block patching, counting or downloading.
  try {
    const info = run.result?.info;
    const payload = sanitizeAnalytics({ run_id: run.analyticsId, event, mode: run.comparisonEncode ? "ab" : "single", preset,
      settings: run.recipe, shared_encode: run.comparisonEncode, attribution: currentAttribution(),
      source: { container: run.file.name.split(".").pop()?.toLowerCase(), size_mb: Math.round(run.file.size / 1048576 * 10) / 10 },
      result: info ? { ...info, codec: /^(avc|h264)/i.test(info.codec) ? "avc" : /^(hev|hvc|h265)/i.test(info.codec) ? "hevc" : /^(vp09|vp9)/i.test(info.codec) ? "vp9" : /^(av01|av1)/i.test(info.codec) ? "av1" : "other",
        size_mb: Math.round(run.result!.blob.size / 1048576 * 10) / 10,
        warnings: run.result!.checks.filter(c => !c.ok && c.warn).length, failed_checks: run.result!.checks.filter(c => !c.ok && !c.warn).length } : undefined,
      elapsed_ms: elapsed == null ? undefined : Math.round(elapsed), failure_category: error ? failureCategory(error) : undefined });
    if (!payload) return;
    void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
  } catch {}
}
