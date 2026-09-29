import { auth } from "../../../../lib/auth/server";
import { queryDb } from "../../../../lib/db";
import {
  getCampaignSnapshot,
  privateHeaders,
} from "../../../../lib/private-data";

export const dynamic = "force-dynamic";

async function userId() {
  const { data: session } = await auth.getSession();
  return session?.user?.id ?? null;
}

export async function GET() {
  const owner = await userId();
  if (!owner) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders() },
    );
  }

  const result = await queryDb(
    `select id, campaign_id, campaign_snapshot, created_at
       from user_favorites
      where auth_user_id = $1
      order by created_at desc`,
    [owner],
  );

  return Response.json(
    {
      items: result.rows,
      campaignIds: result.rows.map((row) => Number(row.campaign_id)),
    },
    { headers: privateHeaders() },
  );
}

export async function POST(request: Request) {
  const owner = await userId();
  if (!owner) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders() },
    );
  }

  const body = await request.json().catch(() => null);
  const campaignId = Number(body?.campaignId);

  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return Response.json(
      { error: "Invalid campaignId" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const snapshot = await getCampaignSnapshot(campaignId);
  if (!snapshot) {
    return Response.json(
      { error: "Campaign not found" },
      { status: 404, headers: privateHeaders() },
    );
  }

  const result = await queryDb(
    `insert into user_favorites (
         auth_user_id,
         campaign_id,
         campaign_snapshot
       )
       values ($1, $2, $3::jsonb)
       on conflict (auth_user_id, campaign_id)
       do update set campaign_snapshot = excluded.campaign_snapshot
       returning id, campaign_id, campaign_snapshot, created_at`,
    [owner, campaignId, JSON.stringify(snapshot)],
  );

  return Response.json(
    { item: result.rows[0], favorited: true },
    { status: 201, headers: privateHeaders() },
  );
}

export async function DELETE(request: Request) {
  const owner = await userId();
  if (!owner) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders() },
    );
  }

  const url = new URL(request.url);
  const campaignId = Number(url.searchParams.get("campaignId"));

  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return Response.json(
      { error: "Invalid campaignId" },
      { status: 400, headers: privateHeaders() },
    );
  }

  await queryDb(
    `delete from user_favorites
      where auth_user_id = $1
        and campaign_id = $2`,
    [owner, campaignId],
  );

  return Response.json(
    { favorited: false },
    { headers: privateHeaders() },
  );
}
