import { getPlatformBrand, platformBrandStyle } from "@/lib/platform-brand";

export function PlatformBadge({
  platform,
  className = "",
}: {
  platform: string;
  className?: string;
}) {
  const brand = getPlatformBrand(platform);
  const classes = ["platform-brand-badge", className].filter(Boolean).join(" ");

  return (
    <span
      className={classes}
      data-platform-brand={brand.id}
      style={platformBrandStyle(platform)}
    >
      {platform}
    </span>
  );
}
