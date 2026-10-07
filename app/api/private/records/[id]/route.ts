import { auth } from "../../../../../lib/auth/server";
import { queryDb } from "../../../../../lib/db";
import {
  normalizeOptionalDeadline,
  normalizeOptionalText,
  privateHeaders,
} from "../../../../../lib/private-data";

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

async function ownerId() {
  const { data: session } = await auth.getSession();
  return session?.user?.id ?? null;
}

function recordId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await ownerId();
  if (!owner) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders() },
    );
  }

  const id = recordId((await params).id);
  if (!id) {
    return Response.json(
      { error: "Invalid id" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json(
      { error: "Invalid body" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const status =
    typeof body.status === "string" && STATUSES.has(body.status)
      ? body.status
      : null;

  if (!status) {
    return Response.json(
      { error: "Invalid status" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const hasNote = Object.prototype.hasOwnProperty.call(body, "note");
  if (
    hasNote &&
    body.note !== null &&
    typeof body.note !== "string"
  ) {
    return Response.json(
      { error: "Invalid note" },
      { status: 400, headers: privateHeaders() },
    );
  }
  const note = hasNote ? normalizeOptionalText(body.note, 4000) : null;

  const hasDeadlineAt = Object.prototype.hasOwnProperty.call(body, "deadlineAt");
  const deadlineAt = hasDeadlineAt
    ? normalizeOptionalDeadline(body.deadlineAt)
    : undefined;
  if (hasDeadlineAt && deadlineAt === undefined) {
    return Response.json(
      { error: "Invalid deadlineAt" },
      { status: 400, headers: privateHeaders() },
    );
  }

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
      hasDeadlineAt,
      deadlineAt ?? null,
    ],
  );

  if (!result.rows[0]) {
    return Response.json(
      { error: "Not found" },
      { status: 404, headers: privateHeaders() },
    );
  }

  return Response.json(
    { item: result.rows[0] },
    { headers: privateHeaders() },
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await ownerId();
  if (!owner) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders() },
    );
  }

  const id = recordId((await params).id);
  if (!id) {
    return Response.json(
      { error: "Invalid id" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const result = await queryDb(
    `delete from user_campaign_records
      where auth_user_id = $1
        and id = $2
      returning id`,
    [owner, id],
  );

  if (!result.rows[0]) {
    return Response.json(
      { error: "Not found" },
      { status: 404, headers: privateHeaders() },
    );
  }

  return Response.json(
    { deleted: true },
    { headers: privateHeaders() },
  );
}
