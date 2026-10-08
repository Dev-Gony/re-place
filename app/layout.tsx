import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Providers } from "./providers";
import { PwaRegister } from "./pwa-register";
import { MobileBottomNav } from "./mobile-bottom-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#171717",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://re-place.devgony.com"),
  title: {
    default: "Re:Place | 체험단 캠페인 통합 검색",
    template: "%s | Re:Place",
  },
  description:
    "디너의여왕, 미블, 리뷰플레이스, 리뷰어스의 모집중 체험단 캠페인을 한곳에서 검색하고 혜택·경쟁률·마감·지역을 비교하세요.",
  applicationName: "Re:Place",
  keywords: [
    "체험단",
    "블로그 체험단",
    "리뷰 체험단",
    "인플루언서 캠페인",
    "체험단 검색",
  ],
  category: "lifestyle",
  creator: "Re:Place",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Re:Place",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.svg",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "Re:Place",
    title: "Re:Place | 체험단 캠페인 통합 검색",
    description:
      "모집중 체험단 캠페인의 혜택·경쟁률·마감·지역을 한곳에서 빠르게 비교하세요.",
  },
  robots: {
    index: true,
    follow: true,
  },
  twitter: {
    card: "summary_large_image",
    title: "Re:Place | 체험단 캠페인 통합 검색",
    description:
      "여러 체험단 플랫폼의 모집중 캠페인을 한곳에서 검색하고 비교하세요.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}
          <MobileBottomNav />
        </Providers>
        <PwaRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
