import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only canonical, indexable pages; /convert is the same app with its patcher panel open.
  return [{ url: `${SITE_URL}/` }];
}
