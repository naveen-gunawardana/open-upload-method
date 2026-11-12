import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

const title = "TikTok Upload Quality & MOV Conversion Guides | OQM";
const description = "Practical guides for video editors: prepare 1080p and 4K TikTok uploads, convert supported MOV files locally, and compare silent-tail with Original OQM.";
export const metadata: Metadata = { title, description, alternates: { canonical: `${SITE_URL}/guides` },
  openGraph: { type: "website", title, description, url: `${SITE_URL}/guides` }, twitter: { card: "summary_large_image", title, description } };

export default function GuidesPage() {
  return <main className="guides-article"><nav className="guides-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / Editor guides</nav>
    <h1>Better upload tests start with a good source.</h1>
    <p className="guides-intro">Practical guides for preparing TikTok videos, converting MOV files and comparing upload methods. Free tools, clear settings, and results you can check yourself.</p>
    <Link prefetch={false} className="guides-cta" href="/convert?utm_source=guide&utm_medium=organic&utm_campaign=editor_launch&utm_content=quality-guide">Open the free patcher →</Link>
    <div className="guides-cards">{GUIDES.map(guide => <article className="guides-card" key={guide.slug}><h2><Link href={`/guides/${guide.slug}`}>{guide.title}</Link></h2><p>{guide.description}</p></article>)}</div>
  </main>;
}
