import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES, guidePatcherUrl, guideUrl } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

export function guideMetadata(slug: string): Metadata {
  const guide = GUIDES.find(g => g.slug === slug);
  if (!guide) notFound();
  const title = `${guide.title} | OQM`;
  return { title, description: guide.description, alternates: { canonical: guideUrl(slug) },
    openGraph: { type: "article", title, description: guide.description, url: guideUrl(slug) },
    twitter: { card: "summary_large_image", title, description: guide.description } };
}
export default function GuideArticle({ slug }: { slug: string }) {
  const guide = GUIDES.find(g => g.slug === slug);
  if (!guide) notFound();
  const jsonLd = { "@context": "https://schema.org", "@graph": [
    { "@type": "TechArticle", headline: guide.title, description: guide.description, url: guideUrl(slug), mainEntityOfPage: guideUrl(slug), inLanguage: "en", datePublished: "2026-11-12", dateModified: "2026-11-12", author: { "@type": "Organization", name: "Open Quality Method", url: SITE_URL } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Editor guides", item: `${SITE_URL}/guides` },
      { "@type": "ListItem", position: 3, name: guide.title, item: guideUrl(slug) },
    ] },
  ] };
  return <main className="guides-article">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g,"\\u003c") }} />
    <nav className="guides-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/guides">Editor guides</Link></nav>
    <h1>{guide.title}</h1><p className="guides-date">Updated November 12, 2026 · By Open Quality Method</p>
    <p className="guides-intro">{guide.intro}</p><Link prefetch={false} className="guides-cta" href={guidePatcherUrl(guide.campaign)}>Open the free patcher →</Link>
    {guide.sections.map(section => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(p => <p key={p}>{p}</p>)}{section.steps && <ol>{section.steps.map(step => <li key={step}>{step}</li>)}</ol>}</section>)}
    <section><h2>Sources and implementation</h2><ul>{guide.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul></section>
    <section><h2>Keep reading</h2><ul>{GUIDES.filter(g => g.slug !== slug).map(g => <li key={g.slug}><Link href={`/guides/${g.slug}`}>{g.title}</Link></li>)}</ul></section>
  </main>;
}
