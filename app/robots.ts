import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: "https://re-place.devgony.com/sitemap.xml",
    host: "https://re-place.devgony.com",
  };
}
