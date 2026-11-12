import Link from "next/link";
import type { ReactNode } from "react";
import "./guides.css";

export default function GuidesLayout({ children }: { children: ReactNode }) {
  return <div className="guides-shell"><div className="guides-wrap">
    <header className="guides-header"><Link href="/">OQM · Open Quality Method</Link><Link href="/guides">Editor guides</Link></header>
    {children}
    <footer className="guides-footer"><Link href="/">Free video patcher</Link><Link href="/guides">All guides</Link><a href="https://github.com/naveen-gunawardana/open-quality-method">Open source on GitHub</a></footer>
  </div></div>;
}
