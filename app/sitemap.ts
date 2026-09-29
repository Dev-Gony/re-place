import type { MetadataRoute } from "next";

const base = "https://re-place.devgony.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${base}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/privacy`,
      changeFrequency: "monthly",
      priority: 0.2,
    },
    {
      url: `${base}/terms`,
      changeFrequency: "monthly",
      priority: 0.2,
    },
  ];
}
