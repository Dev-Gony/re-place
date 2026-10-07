import { auth } from "../../../../lib/auth/server";
import { queryDb } from "../../../../lib/db";
import {
  normalizeOptionalDeadline,
  normalizeOptionalText,
  privateHeaders,
} from "../../../../lib/private-data";

export const dynamic = "force-dynamic";

async function ownerId() {
  const { data: session } = await auth.getSession();
  return session?.user?.id ?? null;
}

function normalizeAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0 || amount > 2_147_483_647) {
    return undefined;
  }
  return amount;
}

export async function GET() {
  const owner = await ownerId();
  if (!owner) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders() },
    );
  }

  const result = await queryDb(
    `select
        r.id as record_id,
        r.title as record_title,
        r.platform as record_platform,
        r.status as record_status,
        s.expected_cash_amount,
        s.expected_provided_value_amount,
        s.expected_points_amount,
        s.expected_reimbursement_amount,
        s.actual_cash_received_amount,
        s.actual_reimbursement_received_amount,
        s.cash_received_at,
        s.reimbursement_received_at,
        s.note,
        c.cash_fee_amount as source_cash_amount,
        c.provided_value_amount as source_provided_value_amount,
        c.points_amount as source_points_amount,
        c.reimbursement_amount as source_reimbursement_amount
       from user_campaign_records r
       left join user_campaign_settlements s
         on s.record_id = r.id
        and s.auth_user_id = r.auth_user_id
       left join campaigns c
         on c.id = r.campaign_id
      where r.auth_user_id = $1
        and r.status <> 'cancelled'
      order by
        case when r.status = 'completed' then 1 else 0 end,
        r.updated_at desc`,
    [owner],
  );

  return Response.json(
    { items: result.rows },
    { headers: privateHeaders() },
  );
}

export async function PUT(request: Request) {
  const owner = await ownerId();
  if (!owner) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders() },
    );
  }

  const body = await request.json().catch(() => null);
  const recordId = Number(body?.recordId);

  if (!Number.isInteger(recordId) || recordId <= 0) {
    return Response.json(
      { error: "Invalid recordId" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const amounts = [
    normalizeAmount(body?.expectedCashAmount),
    normalizeAmount(body?.expectedProvidedValueAmount),
    normalizeAmount(body?.expectedPointsAmount),
    normalizeAmount(body?.expectedReimbursementAmount),
    normalizeAmount(body?.actualCashReceivedAmount),
    normalizeAmount(body?.actualReimbursementReceivedAmount),
  ];

  if (amounts.some((amount) => amount === undefined)) {
    return Response.json(
      { error: "Amounts must be non-negative integers" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const cashReceivedAt = normalizeOptionalDeadline(body?.cashReceivedAt);
  const reimbursementReceivedAt = normalizeOptionalDeadline(
    body?.reimbursementReceivedAt,
  );

  if (cashReceivedAt === undefined || reimbursementReceivedAt === undefined) {
    return Response.json(
      { error: "Invalid settlement date" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const note = normalizeOptionalText(body?.note, 4000);

  const result = await queryDb(
    `insert into user_campaign_settlements (
         auth_user_id,
         record_id,
         expected_cash_amount,
         expected_provided_value_amount,
         expected_points_amount,
         expected_reimbursement_amount,
         actual_cash_received_amount,
         actual_reimbursement_received_amount,
         cash_received_at,
         reimbursement_received_at,
         note
       )
       select
         $1, id, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz, $11
         from user_campaign_records
        where auth_user_id = $1
          and id = $2
       on conflict (auth_user_id, record_id)
       do update set
         expected_cash_amount = excluded.expected_cash_amount,
         expected_provided_value_amount = excluded.expected_provided_value_amount,
         expected_points_amount = excluded.expected_points_amount,
         expected_reimbursement_amount = excluded.expected_reimbursement_amount,
         actual_cash_received_amount = excluded.actual_cash_received_amount,
         actual_reimbursement_received_amount = excluded.actual_reimbursement_received_amount,
         cash_received_at = excluded.cash_received_at,
         reimbursement_received_at = excluded.reimbursement_received_at,
         note = excluded.note,
         updated_at = now()
       returning *`,
    [
      owner,
      recordId,
      ...amounts,
      cashReceivedAt,
      reimbursementReceivedAt,
      note,
    ],
  );

  if (!result.rows[0]) {
    return Response.json(
      { error: "Record not found" },
      { status: 404, headers: privateHeaders() },
    );
  }

  return Response.json(
    { item: result.rows[0] },
    { headers: privateHeaders() },
  );
}
