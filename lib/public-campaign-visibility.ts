export const TEMPORARILY_HIDDEN_PUBLIC_PLATFORMS = [
  "리뷰노트",
  "리뷰노트(공개목록)",
] as const;

export const TEMPORARILY_HIDDEN_PUBLIC_CAMPAIGN_SQL =
  `campaigns.platform NOT IN (${TEMPORARILY_HIDDEN_PUBLIC_PLATFORMS.map(
    (platform) => `'${platform.replaceAll("'", "''")}'`,
  ).join(", ")})`;

export function isPublicCampaignPlatformVisible(platform: string) {
  return !TEMPORARILY_HIDDEN_PUBLIC_PLATFORMS.some(
    (hiddenPlatform) => hiddenPlatform === platform,
  );
}
