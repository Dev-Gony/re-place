import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://re-place.devgony.com"),
  title: {
    default: "Re:Place | 체험단 캠페인 통합 검색",
    template: "%s | Re:Place",
  },
  description:
    "디너의여왕, 미블, 리뷰플레이스, 리뷰어스의 모집중 체험단 캠페인을 한곳에서 검색하고 혜택·경쟁률·마감·지역을 비교하세요.",
  applicationName: "Re:Place",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
