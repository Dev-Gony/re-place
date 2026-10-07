import { queryDb } from "../../../../../../lib/db";
import {
  normalizeDeadline,
  normalizeOptionalText,
} from "../../../../../../lib/private-data";
import {
  currentOwnerId,
  positiveId,
  v1Error,
  v1Mutation,
} from "../../../../../../lib/workspace-api";

export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "saved",
  "applied",
  "selected",
  "visited",
  "review_pending",
  "completed",
  "cancelled",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await currentOwnerId();
  if (!owner) return v1Error("UNAUTHORIZED", "Authentication required", 401);

  const id = positiveId((await params).id);
  if (!id) return v1Error("INVALID_INPUT", "id must be a positive integer", 400);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return v1Error("INVALID_INPUT", "A record update is required", 400);
  }

  const status =
    typeof body.status === "string" && STATUSES.has(body.status)
      ? body.status
      : null;

  if (!status) return v1Error("INVALID_INPUT", "Invalid status", 400);

  const hasNote = Object.prototype.hasOwnProperty.call(body, "note");
  if (
    hasNote &&
    body.note !== null &&
    typeof body.note !== "string"
  ) {
    return v1Error("INVALID_INPUT", "note must be a string or null", 400);
  }

  const note = hasNote ? normalizeOptionalText(body.note, 4000) : null;
  const deadlineAt =
    body.deadlineAt === undefined ? undefined : normalizeDeadline(body.deadlineAt);

  const result = await queryDb(
    `update user_campaign_records
        set status = $3,
            note = case when $4::boolean then $5 else note end,
            deadline_at = case when $6::boolean then $7::timestamptz else deadline_at end,
            updated_at = now()
      where auth_user_id = $1
        and id = $2
      returning *`,
    [
      owner,
      id,
      status,
      hasNote,
      note,
      deadlineAt !== undefined,
      deadlineAt ?? null,
    ],
  );

  if (!result.rows[0]) return v1Error("NOT_FOUND", "Record not found", 404);
  return v1Mutation({ item: result.rows[0] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await currentOwnerId();
  if (!owner) return v1Error("UNAUTHORIZED", "Authentication required", 401);

  const id = positiveId((await params).id);
  if (!id) return v1Error("INVALID_INPUT", "id must be a positive integer", 400);

  const result = await queryDb(
    `delete from user_campaign_records
      where auth_user_id = $1
        and id = $2
      returning id`,
    [owner, id],
  );

  if (!result.rows[0]) return v1Error("NOT_FOUND", "Record not found", 404);
  return v1Mutation({ deleted: true, id });
}
