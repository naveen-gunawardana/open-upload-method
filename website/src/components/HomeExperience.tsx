"use client";

import Image from "next/image";
import Link from "next/link";
import { PatcherContext } from "@/components/PatcherLink";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

const ReviewForm = dynamic(() => import("@/components/ReviewForm"), { ssr: false });

const Converter = dynamic(() => import("@/components/Converter"), {
  ssr: false,
  loading: () => <p className="fine" role="status">Loading patcher…</p>,
});

const GITHUB_URL = "https://github.com/naveen-gunawardana/open-quality-method";
const TIKTOK_URL = "https://www.tiktok.com/@openqualitymethod";

function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function Logo({ size = 44 }: { size?: number }) {
  return <Image src="/logo.png" width={size} height={size} alt="" aria-hidden="true" priority />;
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

export default function HomeExperience({ initialView = "home", children }: { initialView?: "home" | "converter"; children?: ReactNode }) {
  const [view, setView] = useState(initialView);
  const [converterOpened, setConverterOpened] = useState(initialView === "converter");
  const [reviewing, setReviewing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [notVideo, setNotVideo] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [cardHeight, setCardHeight] = useState(560);
  const [sceneBusy, setSceneBusy] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const primaryRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const depth = useRef(0);
  const homeTitle = useRef<HTMLHeadingElement>(null);
  const converterTitle = useRef<HTMLHeadingElement>(null);
  const homePanel = useRef<HTMLElement>(null);
  const converterPanel = useRef<HTMLElement>(null);
  const landingContent = useRef<HTMLDivElement>(null);
  const converterContent = useRef<HTMLDivElement>(null);

  const measureCard = useCallback(() => {
    const panel = view === "converter" ? converterPanel.current : homePanel.current;
    const content = view === "converter" ? converterContent.current : landingContent.current;
    if (!panel || !content || (view === "converter" && !panel.querySelector(".studio"))) return;
    const style = getComputedStyle(panel);
    setCardHeight(Math.ceil(content.getBoundingClientRect().height + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 2));
  }, [view]);

  useEffect(() => {
    const observer = new ResizeObserver(measureCard);
    if (landingContent.current) observer.observe(landingContent.current);
    if (converterContent.current) observer.observe(converterContent.current);
    measureCard();
    return () => observer.disconnect();
  }, [measureCard]);

  const revealSettings = useCallback((event: Event) => {
    const section = event.target;
    if (!(section instanceof HTMLDetailsElement) || !section.open) return;
    requestAnimationFrame(() => {
      const panel = converterPanel.current;
      if (!panel || !section.isConnected) return;
      measureCard();
      panel.scrollTo({
        top: panel.scrollTop + section.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    });
  }, [measureCard]);

  useEffect(() => {
    const panel = converterPanel.current;
    panel?.addEventListener("toggle", revealSettings, true);
    return () => panel?.removeEventListener("toggle", revealSettings, true);
  }, [revealSettings]);

  useEffect(() => {
    const target = primaryRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { stageRef.current?.scrollTo({ top: 0 }); }, [view]);

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
    const refresh = () => { void fetch("/api/download-count", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.count === "number") setCount(previous => previous === null ? d.count : Math.max(previous, d.count));
      })
      .catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
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

  const onCounted = useCallback((n: number | null) => n !== null && setCount(previous => previous === null ? n : Math.max(previous, n)), []);

  return (
    <PatcherContext value={openConverter}>
      <Scene paused={sceneBusy || !heroVisible} />
      <div className="vignette" aria-hidden="true" />

      <main className="stage" ref={stageRef}>
        <div className="primary-section" ref={primaryRef}>
        <div className="header">
          <a className="wordmark" href={TIKTOK_URL} target="_blank" rel="noopener" aria-label="OQM on TikTok, @openqualitymethod">
            <Logo />
            <span className="handle"><TikTokIcon /> @openqualitymethod</span>
          </a>
          <span className="chip">100% free · open source</span>
        </div>

        <div className="hero">
          <div className={`hero-card card-frame${view === "converter" ? " showing-converter" : ""}`} style={{ "--card-height": `${cardHeight}px` } as CSSProperties}>
            <div className="card-slider">
              <section
                ref={homePanel}
                className="card-panel landing-panel"
                aria-labelledby="home-title"
                aria-hidden={view !== "home"}
                inert={view !== "home"}
              >
                <div className="landing-content" ref={landingContent}>
                  <ConvertedCount count={count} />
                  <h1 id="home-title" ref={homeTitle} tabIndex={-1}>Stop TikTok from compressing your video.</h1>
                  <p className="sub">Bypass TikTok compression <strong className="hero-free">for free.</strong> No account or installation needed.</p>

                  <div className="quality-compare" aria-label="Example upload quality comparison">
                    <div className="quality-before">
                      <span>Without OQM</span>
                      <strong>540p · 30fps</strong>
                    </div>
                    <span className="quality-arrow" aria-hidden="true"><ArrowIcon /></span>
                    <div className="quality-after">
                      <span>With OQM</span>
                      <strong title="Supported output; TikTok upload results can vary.">4K · 60fps</strong>
                    </div>
                  </div>

                  <div className="hero-actions">
                    <button type="button" className="btn btn-convert" onClick={openConverter} aria-describedby="hero-free-note">
                      Patch video <ArrowIcon />
                    </button>
                    <p id="hero-free-note" className="hero-free-note">(Free forever)</p>
                  </div>
                  {notVideo && <p className="modal-error">That doesn&rsquo;t look like a video. Try an MP4 or MOV.</p>}

                  <div className="credit">
                    <a href={GITHUB_URL} target="_blank" rel="noopener"><GithubIcon /> View code</a>
                    <span aria-hidden="true">·</span>
                    <button type="button" className="linklike" onClick={() => setReviewing(true)}>Leave a review</button>
                    <span aria-hidden="true">·</span>
                    <Link href="/guides">Editor guides</Link>
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
                <div className="converter-content" ref={converterContent}>
                  <header className="panel-heading">
                    <button type="button" className="panel-back" onClick={goHome} aria-label="Back to overview">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 12H5m6-6-6 6 6 6" />
                      </svg>
                    </button>
                    <div>
                      <h1 id="converter-title" ref={converterTitle} tabIndex={-1}>Patcher</h1>
                    </div>
                  </header>
                  {notVideo && <p className="modal-error">That doesn&rsquo;t look like a video. Try an MP4 or MOV.</p>}
                  {converterOpened && <Converter file={file} standalone embedded onCounted={onCounted} onBusyChange={setSceneBusy} />}
                </div>
              </section>
            </div>
          </div>
          {view === "home" && <a className="hero-next" href="#compare">
            See how it compares with Kuronai and other methods
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14m-6-6 6 6 6-6" /></svg>
          </a>}
        </div>
        </div>
        <div className="landing-below" hidden={view !== "home"}>{children}</div>
      </main>

      {view === "home" && !heroVisible && !reviewing && (
        <div className="free-bar">
          <span>Free forever. No account.</span>
          <button type="button" className="cta" onClick={openConverter}>Patch video free</button>
        </div>
      )}

      {dragging && view === "home" && (
        <div className="drop-overlay" aria-hidden="true">
          <div>Drop to open in patcher</div>
        </div>
      )}
      {reviewing && <ReviewForm onClose={() => setReviewing(false)} />}
    </PatcherContext>
  );
}
