import { CheckpointGrid, TopicMark } from "@/components/EditFigures";
import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES, guidePatcherUrl } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

const title = "TikTok Video Quality, Export & Conversion Guides | OQM";
const description = "Practical TikTok guides for editors: export settings, 1080p and 4K uploads, MOV conversion, 60 fps, blurry playback, browser errors and silent-tail comparisons.";
export const metadata: Metadata = { title, description, alternates: { canonical: `${SITE_URL}/guides`, types: { "application/rss+xml": `${SITE_URL}/guides/feed.xml` } },
  openGraph: { type: "website", title, description, url: `${SITE_URL}/guides` }, twitter: { card: "summary_large_image", title, description } };

export default function GuidesPage() {
  const categories = [...new Set(GUIDES.map(g => g.category))];
  const data = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: `${SITE_URL}/guides`, description, mainEntity: { "@type": "ItemList", itemListElement: GUIDES.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.title, url: `${SITE_URL}/guides/${g.slug}` })) } };
  const featured = GUIDES.find(guide => guide.slug === "tiktok-video-quality")!;
  return <main className="guides-library">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
    <header className="library-head"><h1 className="guides-title">TikTok quality guides.</h1>
      <p>Export settings, upload quality and fixes for editors.</p></header>
    <Link href={`/guides/${featured.slug}`} className="guide-feature">
      <div className="guide-cover" aria-hidden="true">
        <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice"><circle cx="256" cy="112" r="43" fill="#ffe0a0"/>
          <path fill="#91bfc7" d="m0 133 77-62 42 32 26-10 62 55 58-40 20 8 65-64 50 41v128H0Z"/>
          <path fill="#57889a" d="m0 123 66-65 22 13 31-43 22 26 13 6 18 29 20 9 58 72 44 28H0Z"/>
          <path fill="#f1f8ee" d="m66 58 22 13 31-43 22 26 13 6 18 29-27-20-13-9-13-19-12 28-9 6-10 18 3-16Z"/>
          <path fill="#458276" d="M0 122q44 1 122 38t150 20q47-30 128-33v80H0Z"/>
          <path fill="#9fc767" d="M0 150q97 7 155 40t129-4q58-36 116-27v67H0Z"/>
          <path fill="#429458" d="M0 185q70-10 137 13t136 2q58-18 127-7v36H0Z"/></svg>
      </div>
      <div className="feature-copy"><span>Start here</span><h2>{featured.title}</h2><p>Follow one edit from export to upload, then check what TikTok actually plays.</p><b>Read guide →</b></div>
    </Link>
    <nav className="guide-categories" aria-label="Guide topics">{categories.map(category => <a href={`#topic-${category?.toLowerCase().replace(/ /g, "-")}`} key={category}>{category}</a>)}</nav>
    <div className="topics-grid">{categories.map(category => {
      const guides = GUIDES.filter(g => g.category === category && g !== featured);
      return <section className="guide-topic" id={`topic-${category?.toLowerCase().replace(/ /g, "-")}`} key={category}><h2>{category}</h2><div className="guides-cards">{guides.map(guide => <Link className="guides-card" href={`/guides/${guide.slug}`} key={guide.slug}><TopicMark slug={guide.slug}/><h3>{guide.title}</h3><p>{guide.description}</p><span>Read guide →</span></Link>)}</div></section>;
    })}</div>
    <section className="guide-resource"><div><h2>Upload test worksheet</h2><p>Record playback quality after processing, at 24 and 72 hours, and after seven days.</p><a href="/resources/tiktok-upload-test.csv" download>Download worksheet (.csv) ↓</a></div><CheckpointGrid/></section>
    <Link className="sun-action" href={guidePatcherUrl(featured.campaign)}>Open the free patcher →</Link>
  </main>;
}
