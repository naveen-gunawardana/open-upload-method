"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

const ReviewForm = dynamic(() => import("@/components/ReviewForm"), { ssr: false });

const Converter = dynamic(() => import("@/components/Converter"), {
  ssr: false,
  loading: () => <p className="fine" role="status">Loading patcher…</p>,
});

const GITHUB_URL = "https://github.com/naveen-gunawardana/open-upload-method";

function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.79L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.191L.818 6.375a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  );
}

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="url(#oqm-logo-grad)" />
      <path d="M9 9L9 23L20 16L9 9Z" fill="white" />
      <path d="M22 13L25 8L28 13" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <defs>
        <linearGradient id="oqm-logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1f7fe0" />
          <stop offset="1" stopColor="#ffce5c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5v8m0 0L4.5 6M8 9.5 11.5 6" />
      <path d="M2 11.5v1.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function ConvertedCount({ count }: { count: number | null }) {
  if (count === null) return null;
  return (
    <div className="eyebrow eyebrow-dl">
      <DownloadIcon />
      <span className="dl-num">{count.toLocaleString()}</span> videos patched and counting
    </div>
  );
}

const isVideo = (f: File | undefined): f is File => !!f && (f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name));

export default function HomeExperience({ initialView = "home" }: { initialView?: "home" | "converter" }) {
  const [view, setView] = useState(initialView);
  const [converterOpened, setConverterOpened] = useState(initialView === "converter");
  const [reviewing, setReviewing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [notVideo, setNotVideo] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const homeTitle = useRef<HTMLHeadingElement>(null);
  const converterTitle = useRef<HTMLHeadingElement>(null);
  const homePanel = useRef<HTMLElement>(null);
  const converterPanel = useRef<HTMLElement>(null);

  const openConverter = useCallback(() => {
    depth.current = 0;
    setConverterOpened(true);
    setView("converter");
    setDragging(false);
    setNotVideo(false);
  }, []);

  const goHome = useCallback(() => {
    depth.current = 0;
    setDragging(false);
    setView("home");
  }, []);

  useEffect(() => {
    if (!converterOpened) return;
    const title = view === "converter" ? converterTitle : homeTitle;
    const panel = view === "converter" ? converterPanel : homePanel;
    panel.current?.scrollTo({ top: 0 });
    title.current?.focus({ preventScroll: true });
  }, [view, converterOpened]);

  useEffect(() => {
    if (view !== "converter" || reviewing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) goHome();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, reviewing, goHome]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/download-count")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.count === "number") setCount(d.count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback((f: File | undefined) => {
    if (!f) return;
    if (!isVideo(f)) {
      setNotVideo(true);
      return;
    }
    setNotVideo(false);
    setFile(f);
    openConverter();
  }, [openConverter]);

  // The card changes views without remounting the background or losing the selected file.
  useEffect(() => {
    const open = view === "converter";
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      if (!open) setDragging(true);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const leave = () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      start(e.dataTransfer?.files[0]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [view, start]);

  const onCounted = useCallback((n: number | null) => n !== null && setCount(n), []);

  return (
    <>
      <Scene />
      <div className="vignette" aria-hidden="true" />

      <div className="stage">
        <div className="header">
          <div className="wordmark">
            <Logo />
            <b>OQM</b>
          </div>
          <span className="chip">100% free · open source</span>
        </div>

        <div className="hero">
          <div className={`hero-card card-frame${view === "converter" ? " showing-converter" : ""}`}>
            <div className="card-slider">
              <section
                ref={homePanel}
                className="card-panel landing-panel"
                aria-labelledby="home-title"
                aria-hidden={view !== "home"}
                inert={view !== "home"}
              >
                <div className="landing-content">
                  <ConvertedCount count={count} />
                  <h1 id="home-title" ref={homeTitle} tabIndex={-1}>Upload in HD. No compression.</h1>
                  <p className="sub">1080p at 60fps, with no compression. Your video stays on your device. Free, with no account or installation.</p>

                  <div className="quality-compare" aria-label="Example upload quality comparison">
                    <div className="quality-before">
                      <span>Without OQM</span>
                      <strong>540p · 30fps</strong>
                    </div>
                    <span className="quality-arrow" aria-hidden="true"><ArrowIcon /></span>
                    <div className="quality-after">
                      <span>With OQM</span>
                      <strong>1080p · 60fps</strong>
                    </div>
                  </div>

                  <div className="hero-actions">
                    <button type="button" className="drop hero-drop" onClick={() => pickRef.current?.click()}>
                      <b>Drop your video here</b>
                      <span>or click to browse · MP4, MOV &amp; more</span>
                    </button>
                    <button type="button" className="btn btn-convert" onClick={openConverter}>
                      Patch video
                    </button>
                    <div className="hero-secondary">
                      <button type="button" className="btn btn-review" onClick={() => setReviewing(true)}>
                        <StarIcon />
                        Leave a review
                      </button>
                    </div>
                  </div>
                  <input
                    ref={pickRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/*"
                    hidden
                    onChange={(e) => {
                      start(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  {notVideo && <p className="modal-error">That doesn&rsquo;t look like a video. Try an MP4 or MOV.</p>}

                  <div className="credit">
                    <span>Free &amp; open source</span>
                    <span aria-hidden="true">·</span>
                    <a href={GITHUB_URL} target="_blank" rel="noopener"><GithubIcon /> View code</a>
                  </div>
                </div>
              </section>
              <section
                ref={converterPanel}
                className="card-panel converter-panel"
                aria-labelledby="converter-title"
                aria-hidden={view !== "converter"}
                inert={view !== "converter"}
              >
                <header className="panel-heading">
                  <button type="button" className="panel-back" onClick={goHome} aria-label="Back to overview">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 12H5m6-6-6 6 6 6" />
                    </svg>
                  </button>
                  <div>
                    <h1 id="converter-title" ref={converterTitle} tabIndex={-1}>Video patcher</h1>
                    <p className="fine">Choose your settings, then add a video.</p>
                  </div>
                </header>
                {notVideo && <p className="modal-error">That doesn&rsquo;t look like a video. Try an MP4 or MOV.</p>}
                {converterOpened && <Converter file={file} standalone embedded onCounted={onCounted} />}
              </section>
            </div>
          </div>
        </div>
      </div>

      {dragging && view === "home" && (
        <div className="drop-overlay" aria-hidden="true">
          <div>Drop to patch</div>
        </div>
      )}
      {reviewing && <ReviewForm onClose={() => setReviewing(false)} />}
    </>
  );
}
