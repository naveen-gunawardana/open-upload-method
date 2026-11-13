import { GUIDES, guideUrl, guidePublished } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

const xml = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export function GET() {
  const items = [...GUIDES].sort((a,b) => guidePublished(b).localeCompare(guidePublished(a))).map(g => `<item><title>${xml(g.title)}</title><link>${guideUrl(g.slug)}</link><guid isPermaLink="true">${guideUrl(g.slug)}</guid><description>${xml(g.description)}</description><pubDate>${new Date(`${guidePublished(g)}T00:00:00Z`).toUTCString()}</pubDate></item>`).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>OQM Editor Guides</title><link>${SITE_URL}/guides</link><description>Video preparation, export settings and TikTok upload-quality testing for editors.</description><language>en</language><atom:link href="${SITE_URL}/guides/feed.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400", "X-Robots-Tag": "noindex" } });
}
