import { auth } from "../../../../../lib/auth/server";
import { privateHeaders } from "../../../../../lib/private-data";
import { loadWorkspace } from "../../../../../lib/workspace-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: session } = await auth.getSession();

  if (!session?.user?.id) {
    return Response.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      },
      { status: 401, headers: privateHeaders() },
    );
  }

  const snapshot = await loadWorkspace(session.user.id);

  return Response.json(snapshot, {
    headers: privateHeaders(),
  });
}
