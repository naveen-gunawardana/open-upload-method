"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PatcherLink from "@/components/PatcherLink";
import { ThemeToggle } from "@/components/ThemeProvider";

export default function SiteHeader({ onNavigate }: { onNavigate?: (event: { preventDefault: () => void }) => void }) {
  const pathname = usePathname();
  return <header className="site-mast">
    <Link className="site-brand" href="/" onNavigate={onNavigate} aria-label="Open Quality Method home">
      <Image src="/logo.png" width={36} height={36} alt="" priority />
      <span className="brand-full">Open Quality Method</span><span className="brand-short">OQM</span>
    </Link>
    <nav aria-label="Main navigation">
      {pathname === "/convert" ? <span aria-current="page">Patch video</span> : <PatcherLink>Patch video</PatcherLink>}
      <Link href="/guides" onNavigate={onNavigate} aria-current={pathname.startsWith("/guides") ? (pathname === "/guides" ? "page" : "location") : undefined}>Guides</Link>
    </nav>
    <ThemeToggle />
  </header>;
}
