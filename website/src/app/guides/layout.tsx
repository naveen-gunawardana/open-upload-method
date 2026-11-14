import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import type { ReactNode } from "react";
import "./guides.css";

export default function GuidesLayout({ children }: { children: ReactNode }) {
  return <div className="guides-shell"><SiteHeader /><div className="guides-wrap">
    {children}
    <footer className="guides-footer"><Link href="/convert">Free video patcher</Link><Link href="/guides">All guides</Link><a href="/guides/feed.xml">RSS feed</a><a href="https://github.com/naveen-gunawardana/open-quality-method">Open source on GitHub</a></footer>
  </div></div>;
}
