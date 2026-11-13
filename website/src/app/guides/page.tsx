import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

const title = "TikTok Video Quality, Export & Conversion Guides | OQM";
const description = "Practical TikTok guides for editors: export settings, 1080p and 4K uploads, MOV conversion, 60 fps, blurry playback, browser errors and silent-tail comparisons.";
export const metadata: Metadata = { title, description, alternates: { canonical: `${SITE_URL}/guides`, types: { "application/rss+xml": `${SITE_URL}/guides/feed.xml` } },
  openGraph: { type: "website", title, description, url: `${SITE_URL}/guides` }, twitter: { card: "summary_large_image", title, description } };

export default function GuidesPage() {
  const categories = [...new Set(GUIDES.map(g => g.category))];
  const data = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: `${SITE_URL}/guides`, description, mainEntity: { "@type": "ItemList", itemListElement: GUIDES.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.title, url: `${SITE_URL}/guides/${g.slug}` })) } };
  return <main className="guides-article"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} /><nav className="guides-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / Editor guides</nav>
    <h1>TikTok upload quality, explained for editors.</h1>
    <p className="guides-intro">Choose export settings, prepare a supported MOV, diagnose soft playback, or compare methods from one encoded source. Clear steps, primary sources, and results you can check yourself.</p>
    <Link prefetch={false} className="guides-cta" href="/convert?utm_source=guide&utm_medium=organic&utm_campaign=editor_launch&utm_content=quality-guide">Open the free patcher →</Link>
    <nav className="guide-categories" aria-label="Guide topics">{categories.map(category => <a href={`#topic-${category?.toLowerCase().replace(/ /g, "-")}`} key={category}>{category}</a>)}</nav>
    {categories.map(category => <section className="guide-topic" id={`topic-${category?.toLowerCase().replace(/ /g, "-")}`} key={category}><h2>{category}</h2><div className="guides-cards">{GUIDES.filter(g => g.category === category).map(guide => <article className="guides-card" key={guide.slug}><h3><Link href={`/guides/${guide.slug}`}>{guide.title}</Link></h3><p>{guide.description}</p></article>)}</div></section>)}
    <section><h2>A useful test starts with good notes.</h2><p>Keep source, export and playback measurements separate. The retention worksheet has checkpoints for clean MP4, Original OQM and silent-tail comparisons.</p><a href="/resources/tiktok-upload-test.csv" download>Download the free upload-test worksheet (.csv) ↓</a></section>
  </main>;
}
