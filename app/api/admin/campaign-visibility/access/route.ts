import { currentCampaignVisibilityAdmin } from "../../../../../lib/admin/campaign-visibility-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await currentCampaignVisibilityAdmin();

  return Response.json(
    { allowed: access.allowed },
    {
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    },
  );
}
