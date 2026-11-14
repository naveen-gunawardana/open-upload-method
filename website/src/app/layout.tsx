import type { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import VideoSelectionProvider from "@/components/VideoSelectionProvider";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import { siteMetadata } from "@/lib/seo";
import "./globals.css";
import "./site.css";
import "@/components/edit-figures.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const display = Manrope({ variable: "--font-hero", subsets: ["latin"], display: "swap" });

export const metadata = siteMetadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${body.variable} ${display.variable}`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body><ThemeProvider><VideoSelectionProvider>{children}</VideoSelectionProvider></ThemeProvider></body>
    </html>
  );
}
