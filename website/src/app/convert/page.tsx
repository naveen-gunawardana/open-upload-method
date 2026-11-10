"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const Converter = dynamic(() => import("@/components/Converter"), { ssr: false });

export default function ConvertPage() {
  return (
    <main className="converter-page">
      <header className="converter-header">
        <Link className="btn btn-ghost" href="/">← Back to OQM</Link>
        <h1>Convert your video</h1>
        <p>Set up your presets and options before choosing a video.</p>
      </header>
      <Converter standalone />
    </main>
  );
}
