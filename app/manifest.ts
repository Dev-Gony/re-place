import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Re:Place",
    short_name: "Re:Place",
    description: "여러 체험단 플랫폼의 모집중 캠페인을 한곳에서 검색하고 비교하세요.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#171717",
    lang: "ko",
    categories: ["lifestyle", "productivity"],
    icons: [
      {
        src: "/pwa/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/pwa/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/apple-touch-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
