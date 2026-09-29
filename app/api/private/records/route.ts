import { auth } from "../../../../lib/auth/server";
import { queryDb } from "../../../../lib/db";
import {
  getCampaignSnapshot,
  normalizeDeadline,
  normalizeOptionalText,
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
    `select id, campaign_id, source_type, status, title, platform, link,
            reward, region, deadline_at, note, campaign_snapshot,
            created_at, updated_at
       from user_campaign_records
      where auth_user_id = $1
      order by
        case when status in ('completed','cancelled') then 1 else 0 end,
        deadline_at asc nulls last,
        created_at desc`,
    [owner],
  );

  return Response.json(
    { items: result.rows },
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
  if (!body || typeof body !== "object") {
    return Response.json(
      { error: "Invalid body" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const campaignId =
    body.campaignId === null || body.campaignId === undefined
      ? null
      : Number(body.campaignId);

  if (campaignId !== null) {
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

    return Response.json(
      { item: result.rows[0] },
      { status: 201, headers: privateHeaders() },
    );
  }

  const title = normalizeOptionalText(body.title, 240);
  if (!title) {
    return Response.json(
      { error: "Title is required" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const platform = normalizeOptionalText(body.platform, 80);
  const link = normalizeOptionalText(body.link, 1000);
  const reward = normalizeOptionalText(body.reward, 500);
  const region = normalizeOptionalText(body.region, 120);
  const note = normalizeOptionalText(body.note, 4000);
  const deadline = normalizeDeadline(body.deadlineAt);

  const snapshot = {
    title,
    platform,
    link,
    reward,
    region,
    deadline_at: deadline,
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
      deadline,
      note,
      JSON.stringify(snapshot),
    ],
  );

  return Response.json(
    { item: result.rows[0] },
    { status: 201, headers: privateHeaders() },
  );
}
