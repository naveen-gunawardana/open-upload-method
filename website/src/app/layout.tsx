import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Quicksand, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-hero",
  subsets: ["latin"],
  weight: "700",
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

export const metadata: Metadata = {
  title: "OQM: Open Quality Method",
  description:
    "Fight TikTok compression. Free, with no account or installation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${quicksand.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
