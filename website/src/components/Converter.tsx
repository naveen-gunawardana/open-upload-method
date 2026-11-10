"use client";

import { canEncodeVideo } from "mediabunny";
import { useCallback, useEffect, useRef, useState } from "react";
import { CATALOG, DEFAULT_PATCH, type Check, type PatchId } from "@/lib/oqm/patch";
import {
  DEFAULT_RECIPE,
  OqmError,
  PRESETS,
  convert,
  type ConvertResult,
  type EncodeOptions,
  type Recipe,
  type Stage,
} from "@/lib/oqm/pipeline";

type Run = {
  id: number;
  file: File;
  title: string;
  slug: string;
  recipe: Recipe;
  group: number;
  status: "queued" | "running" | "done" | "error";
  stage?: Stage;
  result?: ConvertResult;
  url?: string;
  error?: string;
};

const STORE = "oqm-recipe-v1";

function loadRecipe(): Recipe {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (saved?.encode && saved?.patch) {
      return { encode: { ...DEFAULT_RECIPE.encode, ...saved.encode }, patch: { ...DEFAULT_PATCH, ...saved.patch } };
    }
  } catch {}
  return DEFAULT_RECIPE;
}

function saveRecipe(recipe: Recipe) {
  try {
    localStorage.setItem(STORE, JSON.stringify(recipe));
  } catch {}
}

const same = (a: Recipe, b: Recipe) =>
  JSON.stringify({ ...a, patch: { ...a.patch, enabled: [...a.patch.enabled].sort() } }) ===
  JSON.stringify({ ...b, patch: { ...b.patch, enabled: [...b.patch.enabled].sort() } });

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

const stem = (name: string) => name.replace(/\.[^.]+$/, "");

let nextId = 1;
let nextGroup = 1;

export default function Converter({
  file,
  onClose,
  onCounted,
}: {
  file: File;
  onClose: () => void;
  onCounted: (count: number | null) => void;
}) {
  const [recipe, setRecipeState] = useState<Recipe>(DEFAULT_RECIPE);
  const [runs, setRuns] = useState<Run[]>([]);
  const [hevc, setHevc] = useState<boolean | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [dropping, setDropping] = useState(false);
  const runsRef = useRef<Run[]>([]);
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const counted = useRef(new Set<number>());
  const started = useRef<File | null>(null);
  const closed = useRef(false);
  const pickRef = useRef<HTMLInputElement>(null);

  const setRecipe = (next: Recipe) => {
    setRecipeState(next);
    saveRecipe(next);
  };
  const setEncode = (patch: Partial<EncodeOptions>) => setRecipe({ ...recipe, encode: { ...recipe.encode, ...patch } });
  const setPatch = (patch: Partial<Recipe["patch"]>) => setRecipe({ ...recipe, patch: { ...recipe.patch, ...patch } });

  const update = useCallback((id: number, change: Partial<Run>) => {
    runsRef.current = runsRef.current.map((r) => (r.id === id ? { ...r, ...change } : r));
    setRuns(runsRef.current);
  }, []);

  const count = useCallback(
    (run: Run, mode: "single" | "ab") => {
      if (counted.current.has(run.id)) return;
      counted.current.add(run.id);
      fetch("/api/conversion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) })
        .then((r) => r.json())
        .then((d) => typeof d.count === "number" && onCounted(d.count))
        .catch(() => {});
    },
    [onCounted],
  );

  const pump = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      for (;;) {
        const run = runsRef.current.find((r) => r.status === "queued");
        if (!run || closed.current) break;
        const controller = new AbortController();
        abort.current = controller;
        update(run.id, { status: "running", stage: { label: "Starting", progress: null } });
        try {
          const result = await convert(run.file, run.recipe, (stage) => update(run.id, { stage }), controller.signal);
          if (closed.current || controller.signal.aborted) throw new OqmError("Stopped.");
          update(run.id, { status: "done", result, url: URL.createObjectURL(result.blob) });
          const groupSize = runsRef.current.filter((r) => r.group === run.group).length;
          if (result.checks.every((check) => check.ok || check.warn)) count(run, groupSize > 1 ? "ab" : "single");
        } catch (error) {
          const message = controller.signal.aborted
            ? "Stopped."
            : error instanceof OqmError
              ? error.message
              : `Something went wrong: ${error instanceof Error ? error.message : String(error)}`;
          update(run.id, { status: "error", error: message });
          if (!(error instanceof OqmError) && !controller.signal.aborted) console.error(error);
        }
      }
    } finally {
      busy.current = false;
      abort.current = null;
    }
  }, [count, update]);

  const queue = useCallback(
    (f: File, items: { title: string; slug: string; recipe: Recipe }[]) => {
      if (closed.current) return;
      const group = nextGroup++;
      const fresh = items.map((item) => ({ ...item, id: nextId++, file: f, group, status: "queued" as const }));
      runsRef.current = [...fresh, ...runsRef.current];
      setRuns(runsRef.current);
      void pump();
    },
    [pump],
  );

  const titleFor = (r: Recipe) => PRESETS.find((p) => same(p.recipe, r))?.title ?? "Custom settings";
  const slugFor = (r: Recipe) => {
    const preset = PRESETS.find((p) => same(p.recipe, r));
    return preset ? (preset.id === "current" ? "oqm" : `oqm-${preset.id}`) : "oqm-custom";
  };

  // Dropping a video starts converting straight away with the saved settings.
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || started.current === file) return;
      started.current = file;
      const saved = loadRecipe();
      setRecipeState(saved);
      queue(file, [{ title: titleFor(saved), slug: slugFor(saved), recipe: saved }]);
    });
    return () => { active = false; };
  }, [file, queue]);

  useEffect(() => {
    canEncodeVideo("hevc", { width: 1920, height: 1080 }).then(setHevc).catch(() => setHevc(false));
  }, []);

  // Closing stops any work in progress and drops what's still waiting.
  const close = useCallback(() => {
    closed.current = true;
    runsRef.current = runsRef.current.map((r) => (r.status === "queued" ? { ...r, status: "error", error: "Stopped." } : r));
    abort.current?.abort();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Free converted files and cancel work on every unmount, including navigation.
  useEffect(
    () => {
      closed.current = false;
      return () => {
        closed.current = true;
        abort.current?.abort();
        for (const r of runsRef.current) if (r.url) URL.revokeObjectURL(r.url);
      };
    },
    [],
  );

  const current = runs.find((r) => r.status === "running");
  const files = Array.from(new Set(runs.map((r) => r.file)));
  const activeFile = runs[0]?.file ?? file;
  const presetId = PRESETS.find((p) => same(p.recipe, recipe))?.id ?? "custom";
  const e = recipe.encode;
  const enabled = new Set(recipe.patch.enabled);

  const togglePatch = (id: PatchId) => {
    if (id === "faststart") return;
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPatch({ enabled: CATALOG.map((c) => c.id).filter((c) => next.has(c)) });
  };

  const onPick = (f: File | undefined) => {
    if (f) queue(f, [{ title: titleFor(recipe), slug: slugFor(recipe), recipe }]);
  };

  return (
    <div className="modal-back" onMouseDown={(ev) => ev.target === ev.currentTarget && close()}>
      <div
        className={`studio${dropping ? " studio-drop" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Convert your video"
        onDragOver={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setDropping(false);
          onPick(ev.dataTransfer.files[0]);
        }}
      >
        <button type="button" className="modal-x" onClick={close} aria-label="Close">
          ×
        </button>

        <section className="studio-main">
          <h2>Your videos</h2>
          <p className="modal-note">
            Everything runs in this tab. Your video never leaves your computer. Drop another file here any time.
          </p>

          <ul className="runs">
            {runs.map((run) => (
              <RunCard key={run.id} run={run} showFile={files.length > 1} />
            ))}
          </ul>

          <div className="studio-actions">
            <button
              type="button"
              className="btn btn-patch"
              onClick={() => queue(activeFile, [{ title: titleFor(recipe), slug: slugFor(recipe), recipe }])}
            >
              Convert again with these settings
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => queue(activeFile, PRESETS.map((p) => ({ title: p.title, slug: `lab-${p.id}`, recipe: p.recipe })))}
              title="Builds one file per preset so you can post them side by side"
            >
              Make A/B test set ({PRESETS.length})
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => pickRef.current?.click()}>
              Choose another video
            </button>
            {current && (
              <button type="button" className="again" onClick={() => abort.current?.abort()}>
                Stop current
              </button>
            )}
            <input
              ref={pickRef}
              type="file"
              accept="video/mp4,video/quicktime,video/*"
              hidden
              onChange={(ev) => {
                onPick(ev.target.files?.[0]);
                ev.target.value = "";
              }}
            />
          </div>

          <details className="tip">
            <summary>How to tell if it worked</summary>
            <p>
              Post it, wait about an hour, then open the post in a browser and search the page source for <code>videoQuality</code>.{" "}
              <b>original</b> means TikTok kept your file. <b>normal</b> means it was re-encoded. Accounts that upload a lot can get
              capped at 540p no matter what you post, so test on an account that hasn&rsquo;t uploaded much lately, a few posts at a time.
            </p>
          </details>
        </section>

        <section className="studio-side">
          <h2>Options</h2>
          <div className="presets" role="radiogroup" aria-label="Preset">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={presetId === p.id}
                className={`preset${presetId === p.id ? " on" : ""}`}
                onClick={() => setRecipe(p.recipe)}
              >
                <b>{p.title}</b>
                <span>{p.desc}</span>
              </button>
            ))}
            {presetId === "custom" && (
              <div className="preset on" aria-checked="true" role="radio">
                <b>Custom settings</b>
                <span>Your own mix from Advanced below.</span>
              </div>
            )}
          </div>

          <button type="button" className="adv-toggle" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
            {advanced ? "▾" : "▸"} Advanced
          </button>

          {advanced && (
            <div className="adv">
              <fieldset>
                <legend>Re-encode</legend>
                <label className="row">
                  <input type="checkbox" checked={e.reencode} onChange={(ev) => setEncode({ reencode: ev.target.checked })} />
                  Re-encode before patching
                </label>
                <div className={`grid${e.reencode ? "" : " off"}`}>
                  <label>
                    Codec
                    <select value={e.codec} onChange={(ev) => setEncode({ codec: ev.target.value as EncodeOptions["codec"] })}>
                      <option value="avc">H.264</option>
                      <option value="hevc" disabled={hevc === false}>
                        H.265 / HEVC{hevc === false ? " (not in this browser)" : ""}
                      </option>
                    </select>
                  </label>
                  <label>
                    Rate control
                    <select value={e.rate} onChange={(ev) => setEncode({ rate: ev.target.value as EncodeOptions["rate"] })}>
                      <option value="quantizer">Quality (like CRF)</option>
                      <option value="bitrate">Fixed bitrate</option>
                      <option value="very-high">Very high (auto)</option>
                      <option value="high">High (auto)</option>
                    </select>
                  </label>
                  {e.rate === "quantizer" && (
                    <label>
                      Quality {e.quantizer} <i>(lower = better)</i>
                      <input type="range" min={10} max={30} value={e.quantizer} onChange={(ev) => setEncode({ quantizer: Number(ev.target.value) })} />
                    </label>
                  )}
                  {e.rate === "bitrate" && (
                    <label>
                      Bitrate (Mbps)
                      <input
                        type="number"
                        min={1}
                        max={80}
                        step={0.5}
                        value={e.mbps}
                        onChange={(ev) => setEncode({ mbps: Math.max(1, Number(ev.target.value) || 1) })}
                      />
                    </label>
                  )}
                  <label>
                    Size
                    <select value={e.size} onChange={(ev) => setEncode({ size: ev.target.value as EncodeOptions["size"] })}>
                      <option value="original">Keep original</option>
                      <option value="short-2160">Max 4K (2160p)</option>
                      <option value="short-1440">Max 1440p</option>
                      <option value="short-1080">Max 1080p</option>
                      <option value="short-720">Max 720p</option>
                    </select>
                  </label>
                  <label>
                    Frame rate
                    <select value={e.fps ?? ""} onChange={(ev) => setEncode({ fps: ev.target.value ? Number(ev.target.value) : null })}>
                      <option value="">Keep original</option>
                      <option value="24">24</option>
                      <option value="30">30</option>
                      <option value="60">60</option>
                    </select>
                  </label>
                  <label>
                    Keyframes
                    <select value={e.keyframeSec} onChange={(ev) => setEncode({ keyframeSec: Number(ev.target.value) })}>
                      <option value={1}>Every 1 s</option>
                      <option value={2}>Every 2 s</option>
                      <option value={5}>Every 5 s</option>
                      <option value={0}>Only the first frame (long gap)</option>
                    </select>
                  </label>
                  <label>
                    Audio
                    <select value={e.audioKbps} onChange={(ev) => setEncode({ audioKbps: Number(ev.target.value) })}>
                      <option value={128}>AAC 128 kbps</option>
                      <option value={192}>AAC 192 kbps</option>
                      <option value={256}>AAC 256 kbps</option>
                      <option value={320}>AAC 320 kbps</option>
                    </select>
                  </label>
                  <label>
                    Encoder
                    <select value={e.hardware} onChange={(ev) => setEncode({ hardware: ev.target.value as EncodeOptions["hardware"] })}>
                      <option value="no-preference">Browser decides</option>
                      <option value="prefer-hardware">Prefer hardware (faster)</option>
                      <option value="prefer-software">Prefer software</option>
                    </select>
                  </label>
                </div>
                <p className="fine">
                  The browser encoder can&rsquo;t set the H.264 profile, so the desktop lab&rsquo;s Constrained Baseline variant isn&rsquo;t
                  available here.
                </p>
              </fieldset>

              <fieldset>
                <legend>Patches</legend>
                <ul className="patch-list">
                  {CATALOG.map((p) => (
                    <li key={p.id}>
                      <label className="row">
                        <input type="checkbox" checked={enabled.has(p.id)} disabled={p.id === "faststart"} onChange={() => togglePatch(p.id)} />
                        <span>
                          <em>
                            <b>{p.title}</b> <code>{p.id}</code>
                          </em>
                          <i>{p.summary}</i>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="grid">
                  <label>
                    Decoy inflate (x samples)
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={recipe.patch.inflate}
                      onChange={(ev) => setPatch({ inflate: Math.min(100, Math.max(1, Math.round(Number(ev.target.value)) || 1)) })}
                    />
                  </label>
                  <label>
                    Dummy sample bytes
                    <input
                      type="number"
                      min={0}
                      max={64}
                      placeholder="auto"
                      value={recipe.patch.dummySize ?? ""}
                      onChange={(ev) => setPatch({ dummySize: ev.target.value ? Math.min(64, Math.max(1, Math.round(Number(ev.target.value)))) : null })}
                    />
                  </label>
                  <label>
                    Encoder tag
                    <input type="text" maxLength={64} value={recipe.patch.encoderTag} onChange={(ev) => setPatch({ encoderTag: ev.target.value })} />
                  </label>
                  <label>
                    Trailing pad bytes
                    <input
                      type="number"
                      min={8}
                      max={10_000_000}
                      step={4}
                      value={recipe.patch.trailingBytes}
                      onChange={(ev) => setPatch({ trailingBytes: Math.min(10_000_000, Math.max(8, Math.round(Number(ev.target.value)) || 8)) })}
                    />
                  </label>
                </div>
              </fieldset>

              <button type="button" className="again" onClick={() => setRecipe(DEFAULT_RECIPE)}>
                Reset to recommended
              </button>
            </div>
          )}
          <p className="fine">Changes apply to the next conversion. Settings are remembered in this browser.</p>
        </section>
      </div>
    </div>
  );
}

function RunCard({ run, showFile }: { run: Run; showFile: boolean }) {
  const outName = `${stem(run.file.name)}_${run.slug}.mp4`;
  const hard = run.result?.checks.filter((c) => !c.ok && !c.warn) ?? [];
  return (
    <li className={`run run-${run.status}`}>
      <div className="run-head">
        <b>{run.title}</b>
        {showFile && <span className="run-file">{run.file.name}</span>}
        {run.status === "queued" && <span className="run-tag">waiting</span>}
      </div>

      {run.status === "running" && (
        <div className="run-progress">
          <span>{run.stage?.label ?? "Working"}</span>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.stage?.progress != null ? Math.round(run.stage.progress * 100) : undefined}>
            <div className={run.stage?.progress == null ? "bar-fill bar-busy" : "bar-fill"} style={run.stage?.progress != null ? { width: `${run.stage.progress * 100}%` } : undefined} />
          </div>
        </div>
      )}

      {run.status === "error" && run.error && <p className="modal-error">{run.error}</p>}

      {run.status === "done" && run.result && run.url && (
        <>
          <div className="run-meta">
            {run.result.info.width}x{run.result.info.height} · {Math.round(run.result.info.fps * 100) / 100} fps · {run.result.info.mbps.toFixed(1)} Mbps ·{" "}
            {formatSize(run.result.blob.size)}
            {run.result.info.reencoded ? "" : " · not re-encoded"}
          </div>
          <div className="run-row">
            <a className="btn btn-patch btn-sm" href={run.url} download={outName}>
              Download
            </a>
            <span className={hard.length ? "run-bad" : "run-ok"}>{hard.length ? `${hard.length} check(s) failed` : "All checks passed"}</span>
          </div>
          <details>
            <summary>Details</summary>
            <ul className="checks">
              {run.result.checks.map((c: Check) => (
                <li key={c.name} className={c.ok ? "ok" : "bad"}>
                  <span>{c.ok ? "✓" : c.warn ? "!" : "✕"}</span>
                  <span>
                    {c.name} <i>{c.detail}</i>
                  </span>
                </li>
              ))}
            </ul>
            <p className="fine">
              Applied: {run.result.applied.join(", ")}
              {run.result.skipped.length ? ` · Skipped: ${run.result.skipped.join(", ")}` : ""}
            </p>
            {run.result.notes.map((n) => (
              <p className="fine" key={n}>
                {n}
              </p>
            ))}
          </details>
        </>
      )}
    </li>
  );
}
