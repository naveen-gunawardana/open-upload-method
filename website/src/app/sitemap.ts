import type { MetadataRoute } from "next";
import { GUIDES, guideUrl, guideUpdated } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/` }, { url: `${SITE_URL}/convert` }, { url: `${SITE_URL}/guides` }, ...GUIDES.map(g => ({ url: guideUrl(g.slug), lastModified: guideUpdated(g) }))];
}
