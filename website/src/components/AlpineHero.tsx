"use client";

import { useEffect, useRef } from "react";
import PatcherLink from "@/components/PatcherLink";
import AlpineLandscape from "@/components/AlpineLandscape";
import "./alpine-hero.css";

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Github() {
  return <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" /></svg>;
}

export default function AlpineHero({ onReview, error }: {
  onReview: () => void; error: boolean;
}) {
  const scene = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = scene.current;
    if (!node) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const paint = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      if (motion.matches) {
        node.style.removeProperty("--scene-x");
        node.style.removeProperty("--scene-y");
        node.style.removeProperty("--scene-scroll");
        return;
      }
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      node.style.setProperty("--scene-x", `${pointerX.toFixed(2)}px`);
      node.style.setProperty("--scene-y", `${pointerY.toFixed(2)}px`);
      node.style.setProperty("--scene-scroll", `${Math.min(260, Math.max(0, -rect.top)).toFixed(2)}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || motion.matches) return;
      const rect = node.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 20;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 12;
      schedule();
    };
    const leave = () => { pointerX = 0; pointerY = 0; schedule(); };
    window.addEventListener("scroll", schedule, { passive: true });
    node.addEventListener("pointermove", move, { passive: true });
    node.addEventListener("pointerleave", leave);
    motion.addEventListener("change", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
      motion.removeEventListener("change", schedule);
    };
  }, []);

  return <section ref={scene} className="alpine-hero" aria-labelledby="home-title">
    <div className="alpine-hero-copy">
      <h1 id="home-title">Stop TikTok from <span>compressing your video.</span></h1>
      <p className="alpine-description">Upload <strong>1080p and 4K videos at 60 fps</strong>.<br />Patch in your browser, then post to TikTok.</p>
      <div className="alpine-actions">
        <PatcherLink className="sun-action alpine-start">Patch video for free <Arrow /></PatcherLink>
        <p>Free forever · No account · No installation</p>
      </div>
      {error && <p role="alert" className="modal-error">Choose an MP4 or supported MOV video.</p>}
      <div className="alpine-links">
        <a href="https://github.com/naveen-gunawardana/open-quality-method" target="_blank" rel="noopener"><Github /> View code</a>
        <button type="button" onClick={onReview}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m10 2 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9L7.5 7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>Leave a review</button>
      </div>
    </div>
    <div className="alpine-landscape" aria-hidden="true">

      <AlpineLandscape />
    </div>
  </section>;
}
