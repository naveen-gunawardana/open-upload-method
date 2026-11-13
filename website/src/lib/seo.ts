import type { Metadata } from "next";

export const SITE_URL = "https://www.openqualitymethod.com";
export const SITE_TITLE = "Free TikTok Video Quality Tool | OQM";
export const SITE_DESCRIPTION = "Prepare and patch 1080p and 4K TikTok videos for free with OQM. Process MP4 and supported MOV files locally. No account or installation needed.";

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "Open Quality Method",
  // /convert opens the same interface in its patcher state; consolidate the duplicate onto the homepage.
  alternates: { canonical: `${SITE_URL}/`, types: { "application/rss+xml": `${SITE_URL}/guides/feed.xml` } },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  openGraph: { type: "website", locale: "en_US", siteName: "OQM — Open Quality Method", url: `${SITE_URL}/`, title: SITE_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

// Only facts reflected in the interface. No invented ratings, users, or guaranteed TikTok results.
export const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#project`, name: "Open Quality Method", url: `${SITE_URL}/`, logo: `${SITE_URL}/logo.png`, sameAs: ["https://github.com/naveen-gunawardana/open-quality-method", "https://www.tiktok.com/@openqualitymethod"] },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: "Open Quality Method", alternateName: "OQM", inLanguage: "en", publisher: { "@id": `${SITE_URL}/#project` } },
    { "@type": "WebApplication", "@id": `${SITE_URL}/#app`, name: "Open Quality Method", alternateName: "OQM", url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION, applicationCategory: "MultimediaApplication", operatingSystem: "Web browser",
      isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD", url: `${SITE_URL}/convert` },
      featureList: ["Local video processing", "Video container patching", "H.264/AAC conversion", "MP4 and supported MOV input", "1080p and 4K output presets"],
      sameAs: ["https://github.com/naveen-gunawardana/open-quality-method"],
    },
  ],
};
