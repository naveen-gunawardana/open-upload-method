"use client";

import { useEffect } from "react";

// Animate only the scenery in visible sections; headings and controls keep their layout.
export default function LandscapeParallax() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".home-page .closing-section"));
    const visible = new Set<HTMLElement>();
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let pointerX = 0;
    const paint = () => {
      frame = 0;
      if (motion.matches) {
        sections.forEach(section => {
          section.style.removeProperty("--landscape-x");
          section.style.removeProperty("--landscape-y");
        });
        return;
      }
      visible.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.bottom < -160 || rect.top > innerHeight + 160) return;
        section.style.setProperty("--landscape-x", `${pointerX.toFixed(2)}px`);
        section.style.setProperty("--landscape-y", `${Math.max(-40, Math.min(60, -rect.top * .065)).toFixed(2)}px`);
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || motion.matches) return;
      pointerX = (event.clientX / innerWidth - .5) * 16;
      schedule();
    };
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const section = entry.target as HTMLElement;
        if (entry.isIntersecting) visible.add(section); else visible.delete(section);
      });
      schedule();
    }, { rootMargin: "160px" }) : null;
    sections.forEach(section => { if (observer) observer.observe(section); else visible.add(section); });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    motion.addEventListener("change", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pointermove", move);
      motion.removeEventListener("change", schedule);
      sections.forEach(section => {
        section.style.removeProperty("--landscape-x");
        section.style.removeProperty("--landscape-y");
      });
    };
  }, []);
  return null;
}
