import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms"],
      disallow: ["/api/", "/auth/", "/my"],
    },
    sitemap: "https://re-place.devgony.com/sitemap.xml",
    host: "https://re-place.devgony.com",
  };
}
