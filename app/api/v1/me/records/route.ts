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
import type {
  RecordItem,
  SettlementItem,
} from "../../../../../lib/workspace-contract";

export const dynamic = "force-dynamic";

type RecordCreationRow = RecordItem & {
  settlement_expected_cash_amount: number | null;
  settlement_expected_provided_value_amount: number | null;
  settlement_expected_points_amount: number | null;
  settlement_expected_reimbursement_amount: number | null;
  settlement_actual_cash_received_amount: number | null;
  settlement_actual_reimbursement_received_amount: number | null;
  settlement_cash_received_at: string | null;
  settlement_reimbursement_received_at: string | null;
  settlement_note: string | null;
  source_cash_amount: number | null;
  source_provided_value_amount: number | null;
  source_points_amount: number | null;
  source_reimbursement_amount: number | null;
};

const RECORD_CREATION_SELECT = `
  select
    r.id,
    r.campaign_id,
    r.source_type,
    r.status,
    r.title,
    r.platform,
    r.link,
    r.reward,
    r.region,
    r.deadline_at::text as deadline_at,
    r.note,
    s.expected_cash_amount as settlement_expected_cash_amount,
    s.expected_provided_value_amount as settlement_expected_provided_value_amount,
    s.expected_points_amount as settlement_expected_points_amount,
    s.expected_reimbursement_amount as settlement_expected_reimbursement_amount,
    s.actual_cash_received_amount as settlement_actual_cash_received_amount,
    s.actual_reimbursement_received_amount as settlement_actual_reimbursement_received_amount,
    s.cash_received_at::text as settlement_cash_received_at,
    s.reimbursement_received_at::text as settlement_reimbursement_received_at,
    s.note as settlement_note,
    c.cash_fee_amount as source_cash_amount,
    c.provided_value_amount as source_provided_value_amount,
    c.points_amount as source_points_amount,
    c.reimbursement_amount as source_reimbursement_amount
  from saved_record r
  left join user_campaign_settlements s
    on s.record_id = r.id
   and s.auth_user_id = $1
  left join campaigns c
    on c.id = r.campaign_id`;

function recordCreationPayload(row: RecordCreationRow) {
  const item: RecordItem = {
    id: row.id,
    campaign_id: row.campaign_id,
    source_type: row.source_type,
    status: row.status,
    title: row.title,
    platform: row.platform,
    link: row.link,
    reward: row.reward,
    region: row.region,
    deadline_at: row.deadline_at,
    note: row.note,
  };
  const settlement: SettlementItem = {
    record_id: row.id,
    record_title: row.title,
    record_platform: row.platform,
    record_status: row.status,
    expected_cash_amount: row.settlement_expected_cash_amount,
    expected_provided_value_amount:
      row.settlement_expected_provided_value_amount,
    expected_points_amount: row.settlement_expected_points_amount,
    expected_reimbursement_amount:
      row.settlement_expected_reimbursement_amount,
    actual_cash_received_amount: row.settlement_actual_cash_received_amount,
    actual_reimbursement_received_amount:
      row.settlement_actual_reimbursement_received_amount,
    cash_received_at: row.settlement_cash_received_at,
    reimbursement_received_at: row.settlement_reimbursement_received_at,
    note: row.settlement_note,
    source_cash_amount: row.source_cash_amount,
    source_provided_value_amount: row.source_provided_value_amount,
    source_points_amount: row.source_points_amount,
    source_reimbursement_amount: row.source_reimbursement_amount,
  };

  return { item, settlement };
}

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

    const result = await queryDb<RecordCreationRow>(
      `with saved_record as (
         insert into user_campaign_records (
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
         returning *
       )
       ${RECORD_CREATION_SELECT}`,
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

    return v1Mutation(recordCreationPayload(result.rows[0]), 201);
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

  const result = await queryDb<RecordCreationRow>(
    `with saved_record as (
       insert into user_campaign_records (
         auth_user_id, source_type, status, title, platform, link,
         reward, region, deadline_at, note, campaign_snapshot
       )
       values ($1, 'manual', 'saved', $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       returning *
     )
     ${RECORD_CREATION_SELECT}`,
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

  return v1Mutation(recordCreationPayload(result.rows[0]), 201);
}
