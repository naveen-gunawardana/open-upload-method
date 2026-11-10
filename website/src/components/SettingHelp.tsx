"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function SettingHelp({ label, children }: { label: string; children: string }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; below: boolean; width: number } | null>(null);
  const keepOpen = () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  const hideSoon = () => { hideTimer.current = setTimeout(() => setPosition(null), 120); };
  const show = () => {
    keepOpen();
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(280, window.innerWidth - 32);
    const below = rect.top < 160;
    setPosition({ left: Math.max(16, Math.min(rect.left - width / 2, window.innerWidth - width - 16)), top: below ? rect.bottom + 8 : rect.top - 8, below, width });
  };

  useEffect(() => {
    if (!position) return;
    const dismiss = () => setPosition(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", onKey, true);
      keepOpen();
    };
  }, [position]);

  return <>
    <button ref={trigger} type="button" className="setting-help" aria-label={`About ${label}`} aria-describedby={position ? id : undefined}
      onMouseEnter={show} onMouseLeave={hideSoon} onFocus={show} onBlur={() => setPosition(null)}
      onClick={show}>i</button>
    {position && createPortal(<span id={id} role="tooltip" className="setting-tooltip" onMouseEnter={keepOpen} onMouseLeave={hideSoon} style={{ left: position.left, top: position.top, width: position.width, transform: position.below ? undefined : "translateY(-100%)" }}>{children}</span>, document.body)}
  </>;
}
