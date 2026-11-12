import type { MetadataRoute } from "next";
import { GUIDES, guideUrl } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only canonical, indexable pages; /convert is the same app with its patcher panel open.
  return [{ url: `${SITE_URL}/` }, { url: `${SITE_URL}/guides` }, ...GUIDES.map(g => ({ url: guideUrl(g.slug), lastModified: "2026-11-12" }))];
}
