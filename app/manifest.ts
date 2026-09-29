import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Re:Place",
    short_name: "Re:Place",
    description: "여러 체험단 플랫폼의 모집중 캠페인을 한곳에서 검색하고 비교하세요.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    lang: "ko",
  };
}
