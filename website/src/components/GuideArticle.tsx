import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES, guidePatcherUrl, guideUrl, guidePublished, guideUpdated, sectionId } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

export function guideMetadata(slug: string): Metadata {
  const guide = GUIDES.find(g => g.slug === slug);
  if (!guide) notFound();
  const title = guide.seoTitle ?? `${guide.title} | OQM`;
  const image = { url: `${SITE_URL}/og/guides/${slug}.png`, width: 1200, height: 630, alt: guide.title };
  return { title, description: guide.description, alternates: { canonical: guideUrl(slug), types: { "application/rss+xml": `${SITE_URL}/guides/feed.xml` } },
    openGraph: { type: "article", title, description: guide.description, url: guideUrl(slug), siteName: "Open Quality Method", locale: "en_US", publishedTime: guidePublished(guide), modifiedTime: guideUpdated(guide), section: guide.category, images: [image] },
    twitter: { card: "summary_large_image", title, description: guide.description, images: [image] } };
}
export default function GuideArticle({ slug }: { slug: string }) {
  const guide = GUIDES.find(g => g.slug === slug);
  if (!guide) notFound();
  const related = guide.related?.map(id => GUIDES.find(g => g.slug === id)).filter(g => !!g) ?? GUIDES.filter(g => g.slug !== slug).slice(0, 3);
  const wordCount = [guide.intro, ...guide.sections.flatMap(s => [...s.paragraphs, ...(s.steps ?? [])]), ...(guide.faq ?? []).map(f => f.answer)].join(" ").split(/\s+/).length;
  const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(guideUpdated(guide)));
  const jsonLd = { "@context": "https://schema.org", "@graph": [
    { "@type": "TechArticle", "@id": `${guideUrl(slug)}#article`, headline: guide.title, description: guide.description, url: guideUrl(slug), mainEntityOfPage: guideUrl(slug), inLanguage: "en", datePublished: guidePublished(guide), dateModified: guideUpdated(guide), image: `${SITE_URL}/og/guides/${slug}.png`, articleSection: guide.category, wordCount, author: { "@type": "Organization", name: "Open Quality Method", url: `${SITE_URL}/` } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Editor guides", item: `${SITE_URL}/guides` },
      { "@type": "ListItem", position: 3, name: guide.title, item: guideUrl(slug) },
    ] },
  ] };
  return <main className="guides-article">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g,"\\u003c") }} />
    <nav className="guides-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/guides">Editor guides</Link> / {guide.category}</nav>
    <h1>{guide.title}</h1><p className="guides-date">Updated <time dateTime={guideUpdated(guide)}>{date}</time> · {Math.max(1, Math.ceil(wordCount / 220))} min read · <a href="https://github.com/naveen-gunawardana/open-quality-method">By Open Quality Method</a></p>
    <p className="guides-intro">{guide.intro}</p><Link prefetch={false} className="guides-cta" href={guidePatcherUrl(guide.campaign)}>Open the free patcher →</Link>
    {guide.summary && <aside className="guide-takeaways" aria-label="Key takeaways"><h2>Start here</h2><ul>{guide.summary.map(p => <li key={p}>{p}</li>)}</ul></aside>}
    <nav className="guide-toc" aria-label="On this page"><h2>On this page</h2><ol>{guide.sections.map(section => <li key={section.title}><a href={`#${sectionId(section.title)}`}>{section.title}</a></li>)}{guide.faq && <li><a href="#common-questions">Common questions</a></li>}</ol></nav>
    {guide.sections.map(section => <section key={section.title} id={sectionId(section.title)}><h2>{section.title}</h2>{section.paragraphs.map(p => <p key={p}>{p}</p>)}{section.steps && <ol>{section.steps.map(step => <li key={step}>{step}</li>)}</ol>}
      {section.table && <div className="guide-table-scroll"><table><caption>{section.title}</caption><thead><tr>{section.table.columns.map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{section.table.rows.map((row, i) => <tr key={i}>{row.map((value, j) => j === 0 ? <th scope="row" key={j}>{value}</th> : <td key={j}>{value}</td>)}</tr>)}</tbody></table></div>}
      {section.code && <pre className="guide-code"><code>{section.code}</code></pre>}
      {section.download && <a className="guide-download" href={section.download.href} download>{section.download.label} ↓</a>}
    </section>)}
    {guide.faq && <section id="common-questions" className="guide-faq"><h2>Common questions</h2>{guide.faq.map(f => <details key={f.question}><summary>{f.question}</summary><p>{f.answer}</p></details>)}</section>}
    <section><h2>Sources and implementation</h2><p className="guide-source-note">This guide describes OQM’s current workflow. External upload specifications are labeled for the upload route they cover; local file checks and reported upload observations are separate evidence.</p><ul>{guide.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul></section>
    <section><h2>Keep reading</h2><ul>{related.map(g => <li key={g.slug}><Link href={`/guides/${g.slug}`}>{g.title}</Link></li>)}</ul></section>
  </main>;
}
