"use client";

import AlpineHero from "@/components/AlpineHero";
import LandscapeParallax from "@/components/LandscapeParallax";
import PatcherLink from "@/components/PatcherLink";
import SiteHeader from "@/components/SiteHeader";
import { useVideoSelection } from "@/components/VideoSelectionProvider";
import { useRouter } from "next/navigation";
import { patcherDestination } from "@/lib/conversion-analytics";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";


const ReviewForm = dynamic(() => import("@/components/ReviewForm"), { ssr: false });

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5v8m0 0L4.5 6M8 9.5 11.5 6" />
      <path d="M2 11.5v1.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5" />
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
  const [showPatchLink, setShowPatchLink] = useState(false);
  const primaryRef = useRef<HTMLDivElement>(null);
  const depth = useRef(0);

  useEffect(() => {
    const target = primaryRef.current;
    if (!target) return;
    let frame = 0;
    const closing = target.parentElement?.querySelector(".closing-section");
    const measure = () => {
      frame = 0;
      // Show the bar only once the entire hero (including its scenery) is above the viewport.
      const beforeClosing = !closing || closing.getBoundingClientRect().top >= window.innerHeight;
      setShowPatchLink(target.getBoundingClientRect().bottom <= 0 && beforeClosing);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    resize.observe(target.parentElement ?? target);
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
    };
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
    if (!isVideo(file)) { setNotVideo(true); primaryRef.current?.scrollIntoView({ block: "start" }); return; }
    setNotVideo(false);
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
    <LandscapeParallax />
    <main className="stage home-page">
      <div className="primary-section" ref={primaryRef}>
        <SiteHeader />
        <AlpineHero onReview={() => setReviewing(true)}
          error={notVideo} />
        {count !== null && <div className="alpine-count"><ConvertedCount count={count} /></div>}
      </div>
      <div className="landing-below">{children}</div>
    </main>
    {showPatchLink && !reviewing && !dragging && <div className="free-bar">
      <PatcherLink className="sun-action">Patch video free →</PatcherLink>
    </div>}
    {dragging && <div className="drop-overlay" aria-hidden="true"><div><svg width="30" height="32" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 2h10l6 6v18H4ZM14 2v7h6M8 17h8m-4-4v8"/></svg>Drop to open in patcher</div></div>}
    {reviewing && <ReviewForm onClose={() => setReviewing(false)} />}
  </>;
}
