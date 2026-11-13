"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { useVideoSelection } from "@/components/VideoSelectionProvider";

const Converter = dynamic(() => import("@/components/Converter"), {
  ssr: false, loading: () => <p role="status">Loading patcher…</p>,
});

export default function PatcherPage() {
  const { video } = useVideoSelection();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, []);
  const confirmLeave = (event: { preventDefault: () => void }) => {
    if (busy && !window.confirm("Stop patching and leave this page?")) event.preventDefault();
  };
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  return <main className="stage patcher-page">
    <SiteHeader patcher onNavigate={confirmLeave} />
    <div className="patcher-layout">
      <header className="patcher-intro">
        <Link href="/" className="patcher-back" onNavigate={confirmLeave}>← Back to home</Link>
        <h1>Patch your video.</h1>
        <p>Choose your video, adjust your settings, then press Start.</p>
        <span>4K · 60fps · Free forever</span>
      </header>
      <Converter file={video} standalone onBusyChange={setBusy} />
      <p className="patcher-note">Your video stays on your device. {busy ? "Keep this page open while your video is patching." : "Nothing starts until you press Start."}</p>
    </div>
  </main>;
}
