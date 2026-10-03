import { withDbTransaction } from "../../../../../../lib/db";
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

const TASK_TYPES = new Set(["visit", "content", "submit", "other"]);

type TaskRow = {
  id: number;
  record_id: number;
  task_type: "visit" | "content" | "submit" | "other";
  title: string;
  due_at: string | Date;
  completed_at: string | Date | null;
};

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
    return v1Error("INVALID_INPUT", "A task update is required", 400);
  }

  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const hasTaskType = has("taskType");
  const hasTitle = has("title");
  const hasDueAt = has("dueAt");
  const hasCompleted = has("completed");

  if (!hasTaskType && !hasTitle && !hasDueAt && !hasCompleted) {
    return v1Error("INVALID_INPUT", "A task update is required", 400);
  }

  const taskType =
    hasTaskType &&
    typeof body.taskType === "string" &&
    TASK_TYPES.has(body.taskType)
      ? (body.taskType as TaskRow["task_type"])
      : null;
  const title = hasTitle ? normalizeOptionalText(body.title, 240) : null;
  const dueAt = hasDueAt ? normalizeDeadline(body.dueAt) : null;

  if (
    (hasTaskType && !taskType) ||
    (hasTitle && !title) ||
    (hasDueAt && !dueAt) ||
    (hasCompleted && typeof body.completed !== "boolean")
  ) {
    return v1Error(
      "INVALID_INPUT",
      "taskType, title, dueAt or completed is invalid",
      400,
    );
  }

  const result = await withDbTransaction(async (client) => {
    const currentResult = await client.query<TaskRow>(
      `select *
         from user_campaign_tasks
        where auth_user_id = $1
          and id = $2
        for update`,
      [owner, id],
    );
    const current = currentResult.rows[0];
    if (!current) return { kind: "not-found" as const };

    const nextTaskType = taskType ?? current.task_type;
    const nextTitle = title ?? current.title;
    const nextDueAt = dueAt ?? current.due_at;

    if (hasTaskType || hasTitle || hasDueAt) {
      await client.query(
        `select id
           from user_campaign_records
          where auth_user_id = $1
            and id = $2
          for update`,
        [owner, current.record_id],
      );

      const duplicate = await client.query<{ id: number }>(
        `select id
           from user_campaign_tasks
          where auth_user_id = $1
            and id <> $2
            and record_id = $3
            and task_type = $4
            and title = $5
            and due_at = $6::timestamptz
          limit 1`,
        [owner, id, current.record_id, nextTaskType, nextTitle, nextDueAt],
      );

      if (duplicate.rows[0]) return { kind: "conflict" as const };
    }

    const updated = await client.query<TaskRow>(
      `update user_campaign_tasks
          set task_type = $3,
              title = $4,
              due_at = $5::timestamptz,
              completed_at = case
                when $6::boolean is null then completed_at
                when $6::boolean then coalesce(completed_at, now())
                else null
              end,
              updated_at = now()
        where auth_user_id = $1
          and id = $2
        returning *`,
      [
        owner,
        id,
        nextTaskType,
        nextTitle,
        nextDueAt,
        hasCompleted ? body.completed : null,
      ],
    );

    return { kind: "updated" as const, item: updated.rows[0] };
  });

  if (result.kind === "not-found") {
    return v1Error("NOT_FOUND", "Task not found", 404);
  }
  if (result.kind === "conflict") {
    return v1Error("CONFLICT", "An identical task already exists", 409);
  }
  return v1Mutation({ item: result.item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await currentOwnerId();
  if (!owner) return v1Error("UNAUTHORIZED", "Authentication required", 401);

  const id = positiveId((await params).id);
  if (!id) return v1Error("INVALID_INPUT", "id must be a positive integer", 400);

  const result = await withDbTransaction(async (client) => {
    const deleted = await client.query<{ id: number }>(
      `delete from user_campaign_tasks
        where auth_user_id = $1
          and id = $2
        returning id`,
      [owner, id],
    );
    return deleted.rows[0] ?? null;
  });

  if (!result) return v1Error("NOT_FOUND", "Task not found", 404);
  return v1Mutation({ deleted: true, id });
}
