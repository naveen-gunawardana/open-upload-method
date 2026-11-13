import type { Metadata } from "next";
import SiteStructuredData from "@/components/SiteStructuredData";
import PatcherPage from "@/components/PatcherPage";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Patch Your TikTok Video for Free | OQM",
  description: SITE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/convert` },
  openGraph: { type: "website", siteName: "OQM — Open Quality Method", url: `${SITE_URL}/convert`, title: "Patch Your TikTok Video for Free | OQM", description: SITE_DESCRIPTION, images: [`${SITE_URL}/opengraph-image.png`] },
  twitter: { card: "summary_large_image", title: "Patch Your TikTok Video for Free | OQM", description: SITE_DESCRIPTION, images: [`${SITE_URL}/opengraph-image.png`] },
};

export default function ConvertPage() {
  return <><SiteStructuredData /><PatcherPage /></>;
}
