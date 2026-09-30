import { queryDb } from "../../../../../lib/db";
import {
  normalizeDeadline,
  normalizeOptionalText,
} from "../../../../../lib/private-data";
import {
  currentOwnerId,
  positiveId,
  v1Error,
  v1Mutation,
} from "../../../../../lib/workspace-api";

export const dynamic = "force-dynamic";

const TASK_TYPES = new Set(["visit", "content", "submit", "other"]);

export async function POST(request: Request) {
  const owner = await currentOwnerId();
  if (!owner) return v1Error("UNAUTHORIZED", "Authentication required", 401);

  const body = await request.json().catch(() => null);
  const recordId = positiveId(body?.recordId);
  const taskType =
    typeof body?.taskType === "string" && TASK_TYPES.has(body.taskType)
      ? body.taskType
      : null;
  const title = normalizeOptionalText(body?.title, 240);
  const dueAt = normalizeDeadline(body?.dueAt);

  if (!recordId) {
    return v1Error("INVALID_INPUT", "recordId must be a positive integer", 400);
  }

  if (!taskType || !title || !dueAt) {
    return v1Error(
      "INVALID_INPUT",
      "taskType, title and dueAt are required",
      400,
    );
  }

  const result = await queryDb(
    `insert into user_campaign_tasks (
         auth_user_id, record_id, task_type, title, due_at
       )
       select $1, id, $3, $4, $5::timestamptz
         from user_campaign_records
        where auth_user_id = $1
          and id = $2
       returning *`,
    [owner, recordId, taskType, title, dueAt],
  );

  if (!result.rows[0]) return v1Error("NOT_FOUND", "Record not found", 404);
  return v1Mutation({ item: result.rows[0] }, 201);
}
