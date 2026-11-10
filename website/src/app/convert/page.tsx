"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const Converter = dynamic(() => import("@/components/Converter"), { ssr: false });

export default function ConvertPage() {
  return (
    <main className="converter-page">
      <div className="converter-shell">
        <header className="converter-header">
          <Link className="converter-back" href="/">← OQM</Link>
          <h1>Video converter</h1>
          <p>Your settings first. Your video when you&rsquo;re ready.</p>
        </header>
        <Converter standalone />
      </div>
    </main>
  );
}
