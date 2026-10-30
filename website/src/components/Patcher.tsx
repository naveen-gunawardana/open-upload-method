"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OqmError, patchVideo, type Check } from "@/lib/oqm/patch";

type State =
  | { kind: "idle" }
  | { kind: "working"; name: string; step: string }
  | { kind: "done"; name: string; url: string; fileName: string; size: number; checks: Check[]; summary: string }
  | { kind: "error"; message: string };

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export default function Patcher({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  // Free the patched file's temporary link when it is replaced or the panel closes.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = useCallback(async (file: File) => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setState({ kind: "working", name: file.name, step: "Starting" });
    try {
      const result = await patchVideo(file, (step) => setState({ kind: "working", name: file.name, step }));
      const url = URL.createObjectURL(result.blob);
      urlRef.current = url;
      const base = file.name.replace(/\.[^.]+$/, "");
      setState({
        kind: "done",
        name: file.name,
        url,
        fileName: `${base}_oqm.mp4`,
        size: result.blob.size,
        checks: result.checks,
        summary: result.summary,
      });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof OqmError
            ? error.message
            : "Something went wrong reading that file. Try exporting it again, or use the free download for very large files.",
      });
    }
  }, []);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void run(file);
  };

  const failed = state.kind === "done" && state.checks.some((check) => !check.ok);

  return (
    <div className="modal-back" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Patch a video with OQM">
        <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Patch a video</h2>
        <p className="modal-sub">Your video never leaves this tab. It is read in your browser and nothing is uploaded.</p>

        {(state.kind === "idle" || state.kind === "error") && (
          <>
            <div
              className={`drop ${dragging ? "drop-on" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                pick(event.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && inputRef.current?.click()}
            >
              <b>Drop your MP4 here</b>
              <span>or click to choose a file</span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".mp4,.mov,video/mp4,video/quicktime"
              hidden
              onChange={(event) => pick(event.target.files)}
            />
            {state.kind === "error" && <p className="modal-error">{state.message}</p>}
            <p className="modal-note">Export from your editor at full quality first, with audio on. OQM keeps quality, it can’t add it.</p>
          </>
        )}

        {state.kind === "working" && (
          <div className="working">
            <div className="spinner" aria-hidden="true" />
            <b>{state.name}</b>
            <span>{state.step}…</span>
          </div>
        )}

        {state.kind === "done" && (
          <div className="done">
            <p className={failed ? "modal-error" : "modal-ok"}>
              {failed ? "A check failed. Do not upload this file." : "Ready to upload."}
            </p>
            <p className="modal-note">{state.summary}</p>
            <ul className="checks">
              {state.checks.map((check) => (
                <li key={check.name} className={check.ok ? "ok" : "bad"}>
                  <span>{check.ok ? "✓" : "✕"}</span>
                  <span>
                    {check.name}
                    <i> {check.detail}</i>
                  </span>
                </li>
              ))}
            </ul>
            {!failed && (
              <a className="btn btn-download" href={state.url} download={state.fileName}>
                ⬇ Save {state.fileName} ({formatSize(state.size)})
              </a>
            )}
            <button type="button" className="again" onClick={() => setState({ kind: "idle" })}>
              Patch another video
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
