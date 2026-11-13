"use client";

import Image from "next/image";
import Link from "next/link";
import PatcherLink from "@/components/PatcherLink";

export default function SiteHeader({ patcher = false, onNavigate }: { patcher?: boolean; onNavigate?: (event: { preventDefault: () => void }) => void }) {
  return <header className="page-header">
    <div className="header">
      <a className="wordmark" href="https://www.tiktok.com/@openqualitymethod" target="_blank" rel="noopener" aria-label="OQM on TikTok, @openqualitymethod">
        <Image src="/logo.png" width={44} height={44} alt="" aria-hidden="true" priority />
        <span className="handle"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 0c.3 3 2 4.8 5 5v4c-1.8 0-3.4-.5-5-1.5V17a7 7 0 1 1-7-7v4a3 3 0 1 0 3 3V0z" /></svg>@openqualitymethod</span>
      </a>
      <span className="chip">100% free · open source</span>
    </div>
    <nav className="site-nav" aria-label="Main navigation">
      <Link href="/" onNavigate={onNavigate} aria-current={!patcher ? "page" : undefined}>Home</Link>
      {patcher ? <span aria-current="page">Patch video</span> : <PatcherLink>Patch video</PatcherLink>}
      <Link href="/guides" onNavigate={onNavigate}>Editor guides</Link>
    </nav>
  </header>;
}
