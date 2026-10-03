import { withDbTransaction } from "../../../../../lib/db";
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

type TaskRow = {
  id: number;
  record_id: number;
  task_type: string;
  title: string;
  due_at: string | Date;
  completed_at: string | Date | null;
};

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

  const result = await withDbTransaction(async (client) => {
    const record = await client.query<{ id: number }>(
      `select id
         from user_campaign_records
        where auth_user_id = $1
          and id = $2
        for update`,
      [owner, recordId],
    );

    if (!record.rows[0]) return null;

    const duplicate = await client.query<TaskRow>(
      `select *
         from user_campaign_tasks
        where auth_user_id = $1
          and record_id = $2
          and task_type = $3
          and title = $4
          and due_at = $5::timestamptz
        limit 1`,
      [owner, recordId, taskType, title, dueAt],
    );

    if (duplicate.rows[0]) {
      return { item: duplicate.rows[0], created: false };
    }

    const inserted = await client.query<TaskRow>(
      `insert into user_campaign_tasks (
         auth_user_id, record_id, task_type, title, due_at
       )
       values ($1, $2, $3, $4, $5::timestamptz)
       returning *`,
      [owner, recordId, taskType, title, dueAt],
    );

    return { item: inserted.rows[0], created: true };
  });

  if (!result) return v1Error("NOT_FOUND", "Record not found", 404);
  return v1Mutation(result, result.created ? 201 : 200);
}
