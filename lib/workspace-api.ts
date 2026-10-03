import { auth } from "./auth/server";
import { privateHeaders } from "./private-data";
import { WORKSPACE_SCHEMA_VERSION } from "./workspace-contract";

export async function currentOwnerId() {
  const { data: session } = await auth.getSession();
  return session?.user?.id ?? null;
}

export function v1Error(
  code: "UNAUTHORIZED" | "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT",
  message: string,
  status: number,
) {
  return Response.json(
    { error: { code, message } },
    { status, headers: privateHeaders() },
  );
}

export function v1Mutation<T>(data: T, status = 200) {
  return Response.json(
    {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      mutatedAt: new Date().toISOString(),
      data,
    },
    { status, headers: privateHeaders() },
  );
}

export function positiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
