"use client";
import { useEffect, useRef, type ReactNode } from "react";

// Adds "in" once the block scrolls into view, so a graphic can play a single time.
export default function InView({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    // The server-rendered graphic stays visible without JavaScript or motion.
    if (!node || typeof IntersectionObserver === "undefined"
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || node.getBoundingClientRect().top < window.innerHeight) return;

    node.dataset.animate = "true";
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { node.classList.add("in"); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      delete node.dataset.animate;
      node.classList.remove("in");
    };
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
