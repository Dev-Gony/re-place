import { queryDb } from "../../../../../lib/db";
import { getCampaignSnapshot } from "../../../../../lib/private-data";
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
  const campaignId = positiveId(body?.campaignId);
  if (!campaignId) {
    return v1Error("INVALID_INPUT", "campaignId must be a positive integer", 400);
  }

  const snapshot = await getCampaignSnapshot(campaignId);
  if (!snapshot) return v1Error("NOT_FOUND", "Campaign not found", 404);

  const result = await queryDb(
    `insert into user_favorites (
         auth_user_id, campaign_id, campaign_snapshot
       )
       values ($1, $2, $3::jsonb)
       on conflict (auth_user_id, campaign_id)
       do update set campaign_snapshot = excluded.campaign_snapshot
       returning id, campaign_id, campaign_snapshot, created_at`,
    [owner, campaignId, JSON.stringify(snapshot)],
  );

  return v1Mutation(
    { item: result.rows[0], favorited: true },
    201,
  );
}
