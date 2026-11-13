import type { ReactNode } from "react";
import { Schibsted_Grotesk, Quicksand, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import { siteMetadata } from "@/lib/seo";
import "./globals.css";

const inter = Schibsted_Grotesk({
  variable: "--font-hero",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const quicksand = Quicksand({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata = siteMetadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${quicksand.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
