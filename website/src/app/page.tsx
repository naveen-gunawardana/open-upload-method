"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });
const Patcher = dynamic(() => import("@/components/Patcher"), { ssr: false });

const GITHUB_URL = "https://github.com/naveen-gunawardana/open-upload-method";
const ZIP_URL = "/api/download";

function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.79L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.191L.818 6.375a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  );
}

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="url(#oqm-logo-grad)" />
      <path d="M9 9L9 23L20 16L9 9Z" fill="white" />
      <path d="M22 13L25 8L28 13" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <defs>
        <linearGradient id="oqm-logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1f7fe0" />
          <stop offset="1" stopColor="#ffce5c" />
        </linearGradient>
      </defs>
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

function DownloadCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/download-count")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.count === "number") setCount(d.count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null) return null;
  return (
    <div className="eyebrow eyebrow-dl">
      <DownloadIcon />
      <span className="dl-num">{count.toLocaleString()}</span> downloads and counting
    </div>
  );
}

export default function Home() {
  const [patching, setPatching] = useState(false);

  return (
    <>
      <Scene />
      <div className="vignette" aria-hidden="true" />

      <div className="stage">
        <div className="header">
          <div className="wordmark">
            <Logo />
            <b>OQM</b>
          </div>
          <span className="chip">100% free · open source</span>
        </div>

        <div className="hero">
          <div className="hero-card">
            <DownloadCount />
            <h1>Stop TikTok from crushing your video.</h1>
            <p className="sub">Upload in 4K, no compression. Patch a video right here in your browser, or run it on your machine. Free, no account needed.</p>

            <div className="compare">
              <span className="pill no">
                without OQM → <span className="pill-res">576p</span> · 30fps · 1.5 Mbps
              </span>
              <span className="pill yes">
                with OQM → <span className="pill-res">4K</span> · 60fps · 11.5 Mbps
              </span>
            </div>

            <div className="cta-row">
              <button type="button" className="btn btn-patch" onClick={() => setPatching(true)}>
                Patch a video now
              </button>
              <a className="btn btn-star" href={GITHUB_URL} target="_blank" rel="noopener">
                <StarIcon />
                Star on GitHub
              </a>
              <a className="btn btn-ghost" href={GITHUB_URL} target="_blank" rel="noopener">
                <GithubIcon />
                View repo
              </a>
              <a className="btn btn-ghost" href={ZIP_URL} target="_blank" rel="noopener">
                ⬇ Download ZIP — free
              </a>
            </div>

            <div className="credit">Zero compression · completely free forever</div>
          </div>
        </div>
      </div>
      {patching && <Patcher onClose={() => setPatching(false)} />}
    </>
  );
}
