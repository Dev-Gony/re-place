import { auth } from "../../../../../lib/auth/server";
import { queryDb } from "../../../../../lib/db";
import { privateHeaders } from "../../../../../lib/private-data";

export const dynamic = "force-dynamic";

async function ownerId() {
  const { data: session } = await auth.getSession();
  return session?.user?.id ?? null;
}

function taskId(value: string) {
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

  const id = taskId((await params).id);
  if (!id) {
    return Response.json(
      { error: "Invalid id" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.completed !== "boolean") {
    return Response.json(
      { error: "completed must be boolean" },
      { status: 400, headers: privateHeaders() },
    );
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

  const id = taskId((await params).id);
  if (!id) {
    return Response.json(
      { error: "Invalid id" },
      { status: 400, headers: privateHeaders() },
    );
  }

  const result = await queryDb(
    `delete from user_campaign_tasks
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
