import { auth } from "../../../../../lib/auth/server";
import { privateHeaders } from "../../../../../lib/private-data";
import { WORKSPACE_SCHEMA_VERSION } from "../../../../../lib/workspace-contract";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: session } = await auth.getSession();
  const user = session?.user ?? null;

  return Response.json(
    {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      authTransport: "cookie-session",
      authenticated: Boolean(user),
      user: user
        ? {
            id: user.id,
            name: user.name ?? null,
            email: user.email ?? null,
          }
        : null,
    },
    {
      headers: privateHeaders(),
    },
  );
}
