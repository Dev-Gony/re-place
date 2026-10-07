import { queryDb } from "../../../../../../lib/db";
import {
  normalizeOptionalDeadline,
  normalizeOptionalText,
} from "../../../../../../lib/private-data";
import {
  currentOwnerId,
  positiveId,
  v1Error,
  v1Mutation,
} from "../../../../../../lib/workspace-api";

export const dynamic = "force-dynamic";

function normalizeAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0 || amount > 2_147_483_647) {
    return undefined;
  }
  return amount;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const owner = await currentOwnerId();
  if (!owner) return v1Error("UNAUTHORIZED", "Authentication required", 401);

  const recordId = positiveId((await params).recordId);
  if (!recordId) {
    return v1Error("INVALID_INPUT", "recordId must be a positive integer", 400);
  }

  const body = await request.json().catch(() => null);

  const amounts = [
    normalizeAmount(body?.expectedCashAmount),
    normalizeAmount(body?.expectedProvidedValueAmount),
    normalizeAmount(body?.expectedPointsAmount),
    normalizeAmount(body?.expectedReimbursementAmount),
    normalizeAmount(body?.actualCashReceivedAmount),
    normalizeAmount(body?.actualReimbursementReceivedAmount),
  ];

  if (amounts.some((amount) => amount === undefined)) {
    return v1Error(
      "INVALID_INPUT",
      "Amounts must be non-negative integers",
      400,
    );
  }

  const cashReceivedAt = normalizeOptionalDeadline(body?.cashReceivedAt);
  const reimbursementReceivedAt = normalizeOptionalDeadline(
    body?.reimbursementReceivedAt,
  );

  if (cashReceivedAt === undefined || reimbursementReceivedAt === undefined) {
    return v1Error("INVALID_INPUT", "Invalid settlement date", 400);
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

  if (!result.rows[0]) return v1Error("NOT_FOUND", "Record not found", 404);
  return v1Mutation({ item: result.rows[0] });
}
