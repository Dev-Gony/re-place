import { queryDb } from "../../../../../lib/db";
import {
  getCampaignSnapshot,
  normalizeOptionalDeadline,
  normalizeOptionalText,
} from "../../../../../lib/private-data";
import {
  currentOwnerId,
  positiveId,
  v1Error,
  v1Mutation,
} from "../../../../../lib/workspace-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const owner = await currentOwnerId();
  if (!owner) return v1Error("UNAUTHORIZED", "Authentication required", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return v1Error("INVALID_INPUT", "Request body must be a JSON object", 400);
  }

  const rawCampaignId = body.campaignId;
  const campaignId =
    rawCampaignId === null || rawCampaignId === undefined
      ? null
      : positiveId(rawCampaignId);

  if (rawCampaignId !== null && rawCampaignId !== undefined && !campaignId) {
    return v1Error("INVALID_INPUT", "campaignId must be a positive integer", 400);
  }

  if (campaignId) {
    const snapshot = await getCampaignSnapshot(campaignId);
    if (!snapshot) return v1Error("NOT_FOUND", "Campaign not found", 404);

    const result = await queryDb(
      `insert into user_campaign_records (
           auth_user_id, campaign_id, source_type, status,
           title, platform, link, reward, region, deadline_at,
           campaign_snapshot
         )
         values ($1, $2, 'linked', 'saved', $3, $4, $5, $6, $7, $8, $9::jsonb)
         on conflict (auth_user_id, campaign_id)
         where campaign_id is not null
         do update set
           title = excluded.title,
           platform = excluded.platform,
           link = excluded.link,
           reward = excluded.reward,
           region = excluded.region,
           deadline_at = excluded.deadline_at,
           campaign_snapshot = excluded.campaign_snapshot,
           updated_at = now()
         returning *`,
      [
        owner,
        campaignId,
        snapshot.title || "제목 없음",
        snapshot.platform,
        snapshot.link,
        snapshot.reward,
        snapshot.region,
        snapshot.deadline_at,
        JSON.stringify(snapshot),
      ],
    );

    return v1Mutation({ item: result.rows[0] }, 201);
  }

  const title = normalizeOptionalText(body.title, 240);
  if (!title) return v1Error("INVALID_INPUT", "title is required", 400);

  const platform = normalizeOptionalText(body.platform, 80);
  const link = normalizeOptionalText(body.link, 1000);
  const reward = normalizeOptionalText(body.reward, 500);
  const region = normalizeOptionalText(body.region, 120);
  const note = normalizeOptionalText(body.note, 4000);
  const deadlineAt = normalizeOptionalDeadline(body.deadlineAt);
  if (deadlineAt === undefined) {
    return v1Error("INVALID_INPUT", "deadlineAt must be a valid date", 400);
  }

  const snapshot = {
    title,
    platform,
    link,
    reward,
    region,
    deadline_at: deadlineAt,
    manual: true,
  };

  const result = await queryDb(
    `insert into user_campaign_records (
         auth_user_id, source_type, status, title, platform, link,
         reward, region, deadline_at, note, campaign_snapshot
       )
       values ($1, 'manual', 'saved', $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       returning *`,
    [
      owner,
      title,
      platform,
      link,
      reward,
      region,
      deadlineAt,
      note,
      JSON.stringify(snapshot),
    ],
  );

  return v1Mutation({ item: result.rows[0] }, 201);
}
