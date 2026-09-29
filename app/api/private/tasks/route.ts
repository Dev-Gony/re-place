import { auth } from "../../../../lib/auth/server";
import { queryDb } from "../../../../lib/db";
import {
  normalizeDeadline,
  normalizeOptionalText,
  privateHeaders,
} from "../../../../lib/private-data";

export const dynamic = "force-dynamic";

const TASK_TYPES = new Set(["visit", "content", "submit", "other"]);

async function ownerId() {
  const { data: session } = await auth.getSession();
  return session?.user?.id ?? null;
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
    `select t.id, t.record_id, t.task_type, t.title,
            t.due_at, t.completed_at, t.created_at, t.updated_at,
            r.title as record_title, r.platform as record_platform
       from user_campaign_tasks t
       join user_campaign_records r
         on r.id = t.record_id
        and r.auth_user_id = t.auth_user_id
      where t.auth_user_id = $1
      order by
        case when t.completed_at is null then 0 else 1 end,
        t.due_at asc,
        t.created_at desc`,
    [owner],
  );

  return Response.json(
    { items: result.rows },
    { headers: privateHeaders() },
  );
}

export async function POST(request: Request) {
  const owner = await ownerId();
  if (!owner) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders() },
    );
  }

  const body = await request.json().catch(() => null);
  const recordId = Number(body?.recordId);
  const taskType =
    typeof body?.taskType === "string" && TASK_TYPES.has(body.taskType)
      ? body.taskType
      : null;
  const title = normalizeOptionalText(body?.title, 240);
  const dueAt = normalizeDeadline(body?.dueAt);

  if (!Number.isInteger(recordId) || recordId <= 0) {
    return Response.json(
      { error: "Invalid recordId" },
      { status: 400, headers: privateHeaders() },
    );
  }

  if (!taskType || !title || !dueAt) {
    return Response.json(
      { error: "Task type, title and due date are required" },
      { status: 400, headers: privateHeaders() },
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

  if (!result.rows[0]) {
    return Response.json(
      { error: "Record not found" },
      { status: 404, headers: privateHeaders() },
    );
  }

  return Response.json(
    { item: result.rows[0] },
    { status: 201, headers: privateHeaders() },
  );
}
