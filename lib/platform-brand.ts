import type { CSSProperties } from "react";

type PlatformBrandSource = "user-requested" | "official-site" | "neutral";

export type PlatformBrand = {
  id: string;
  aliases: readonly string[];
  accent: string;
  ink: string;
  soft: string;
  border: string;
  source: PlatformBrandSource;
};

type PlatformBrandStyle = CSSProperties & Record<`--platform-${string}`, string>;

export const PLATFORM_BRANDS: readonly PlatformBrand[] = [
  {
    id: "gangnam",
    aliases: ["강남맛집"],
    accent: "#F97316",
    ink: "#9A3412",
    soft: "#FFF7ED",
    border: "#FDBA74",
    source: "user-requested",
  },
  {
    id: "revu",
    aliases: ["레뷰", "레뷰(인플렉서)"],
    accent: "#7C3AED",
    ink: "#5B21B6",
    soft: "#F5F3FF",
    border: "#C4B5FD",
    source: "user-requested",
  },
  {
    id: "reviewnote",
    aliases: ["리뷰노트", "리뷰노트(공개목록)"],
    accent: "#16A34A",
    ink: "#166534",
    soft: "#F0FDF4",
    border: "#86EFAC",
    source: "user-requested",
  },
  {
    id: "dinnerqueen",
    aliases: ["디너의여왕"],
    accent: "#E11D48",
    ink: "#9F1239",
    soft: "#FFF1F2",
    border: "#FDA4AF",
    source: "official-site",
  },
  {
    id: "reviewus",
    aliases: ["리뷰어스"],
    accent: "#2563EB",
    ink: "#1E40AF",
    soft: "#EFF6FF",
    border: "#93C5FD",
    source: "official-site",
  },
] as const;

const NEUTRAL_PLATFORM_BRAND: PlatformBrand = {
  id: "neutral",
  aliases: [],
  accent: "#5F6672",
  ink: "#3F454E",
  soft: "#F5F6F7",
  border: "#D7DADF",
  source: "neutral",
};

const platformBrandByAlias = new Map(
  PLATFORM_BRANDS.flatMap((brand) =>
    brand.aliases.map((alias) => [alias, brand] as const),
  ),
);

export function getPlatformBrand(platform: string): PlatformBrand {
  return platformBrandByAlias.get(platform.trim()) ?? NEUTRAL_PLATFORM_BRAND;
}

export function platformBrandStyle(platform: string): PlatformBrandStyle {
  const brand = getPlatformBrand(platform);

  return {
    "--platform-accent": brand.accent,
    "--platform-ink": brand.ink,
    "--platform-soft": brand.soft,
    "--platform-border": brand.border,
  };
}
