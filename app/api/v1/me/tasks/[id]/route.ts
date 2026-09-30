import { queryDb } from "../../../../../../lib/db";
import {
  currentOwnerId,
  positiveId,
  v1Error,
  v1Mutation,
} from "../../../../../../lib/workspace-api";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await currentOwnerId();
  if (!owner) return v1Error("UNAUTHORIZED", "Authentication required", 401);

  const id = positiveId((await params).id);
  if (!id) return v1Error("INVALID_INPUT", "id must be a positive integer", 400);

  const body = await request.json().catch(() => null);
  if (typeof body?.completed !== "boolean") {
    return v1Error("INVALID_INPUT", "completed must be boolean", 400);
  }

  const result = await queryDb(
    `update user_campaign_tasks
        set completed_at = case
              when $3::boolean then coalesce(completed_at, now())
              else null
            end,
            updated_at = now()
      where auth_user_id = $1
        and id = $2
      returning *`,
    [owner, id, body.completed],
  );

  if (!result.rows[0]) return v1Error("NOT_FOUND", "Task not found", 404);
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
    `delete from user_campaign_tasks
      where auth_user_id = $1
        and id = $2
      returning id`,
    [owner, id],
  );

  if (!result.rows[0]) return v1Error("NOT_FOUND", "Task not found", 404);
  return v1Mutation({ deleted: true, id });
}
