import { queryDb } from "./db";

export type CampaignSnapshot = {
  id: number;
  platform: string | null;
  title: string | null;
  link: string | null;
  reward: string | null;
  region: string | null;
  deadline_at: string | null;
};

export async function getCampaignSnapshot(
  campaignId: number,
): Promise<CampaignSnapshot | null> {
  const result = await queryDb<CampaignSnapshot>(
    `select id, platform, title, link, reward, region, deadline_at
       from campaigns
      where id = $1
      limit 1`,
    [campaignId],
  );

  return result.rows[0] ?? null;
}

export function privateHeaders() {
  return {
    "Cache-Control": "private, no-store",
  };
}

export function normalizeOptionalText(value: unknown, max = 2000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function normalizeDeadline(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
