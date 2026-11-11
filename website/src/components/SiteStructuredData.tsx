import { siteStructuredData } from "@/lib/seo";

export default function SiteStructuredData() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteStructuredData).replace(/</g, "\\u003c") }} />;
}
