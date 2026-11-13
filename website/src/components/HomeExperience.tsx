"use client";

import Link from "next/link";
import PatcherLink from "@/components/PatcherLink";
import SiteHeader from "@/components/SiteHeader";
import { useVideoSelection } from "@/components/VideoSelectionProvider";
import { useRouter } from "next/navigation";
import { patcherDestination } from "@/lib/conversion-analytics";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

const ReviewForm = dynamic(() => import("@/components/ReviewForm"), { ssr: false });

const GITHUB_URL = "https://github.com/naveen-gunawardana/open-quality-method";
function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
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

export default function HomeExperience({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const { setVideo } = useVideoSelection();
  const [reviewing, setReviewing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notVideo, setNotVideo] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const primaryRef = useRef<HTMLDivElement>(null);
  const depth = useRef(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const target = primaryRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

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

  const selectVideo = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!isVideo(file)) { setNotVideo(true); return; }
    setVideo(file);
    router.push(patcherDestination());
  }, [router, setVideo]);

  useEffect(() => {
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault(); depth.current++; setDragging(true);
    };
    const over = (event: DragEvent) => { if (hasFiles(event)) event.preventDefault(); };
    const leave = () => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault(); depth.current = 0; setDragging(false);
      selectVideo(event.dataTransfer?.files[0]);
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
  }, [selectVideo]);

  return <>
    <Scene paused={!heroVisible} />
    <div className="vignette" aria-hidden="true" />
    <main className="stage home-page">
      <div className="primary-section" ref={primaryRef}>
        <SiteHeader />
        <section className="home-hero" aria-labelledby="home-title">
          <div className="landing-content hero-spread">
                  <ConvertedCount count={count} />
                  <h1 id="home-title">Stop TikTok from compressing your video.</h1>
                  <p className="sub">Prepare 4K videos at 60 fps <strong className="hero-free">for free.</strong> No account or installation needed.</p>

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
                    <PatcherLink className="btn btn-convert">
                      Patch video <ArrowIcon />
                    </PatcherLink>
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
      </div>
      <div className="landing-below">{children}</div>
    </main>
    {!heroVisible && !reviewing && <div className="free-bar">
      <span>Free forever. No account.</span><PatcherLink className="cta">Patch video free</PatcherLink>
    </div>}
    {dragging && <div className="drop-overlay" aria-hidden="true"><div>Drop to open in patcher</div></div>}
    {reviewing && <ReviewForm onClose={() => setReviewing(false)} />}
  </>;
}
