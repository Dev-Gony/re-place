import {
  isCampaignVisibilityAdminEnabled,
} from "../../../../lib/admin/campaign-visibility-access";
import {
  CAMPAIGN_PUBLICATION_STATES,
  isSameOriginMutation,
  parseCampaignVisibilityMutation,
  type CampaignPublicationState,
} from "../../../../lib/admin/campaign-visibility-contract";
import { loadCampaignVisibilityAdminData } from "../../../../lib/admin/campaign-visibility-data";
import { currentCampaignVisibilityAdmin } from "../../../../lib/admin/campaign-visibility-server";
import {
  CampaignVisibilityConflictError,
  CampaignVisibilityNotFoundError,
  mutateCampaignVisibility,
} from "../../../../lib/admin/campaign-visibility-service";
import { PUBLIC_CAMPAIGN_CACHE_TAG } from "../../../../lib/campaign-cache";
import { withDbTransaction } from "../../../../lib/db";
import { privateHeaders } from "../../../../lib/private-data";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

function error(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: privateHeaders() },
  );
}

async function requireAdmin() {
  const access = await currentCampaignVisibilityAdmin();
  if (access.allowed) return access;
  if (access.reason === "feature_disabled") return error("Not found", 404);
  if (access.reason === "unauthenticated") return error("Unauthorized", 401);
  return error("Forbidden", 403);
}

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (access instanceof Response) return access;

  const url = new URL(request.url);
  const rawState = url.searchParams.get("state") ?? "all";
  const state = CAMPAIGN_PUBLICATION_STATES.includes(
    rawState as CampaignPublicationState,
  )
    ? (rawState as CampaignPublicationState)
    : "all";

  const data = await loadCampaignVisibilityAdminData({
    q: url.searchParams.get("q") ?? "",
    platform: url.searchParams.get("platform") ?? "",
    state,
  });
  return Response.json({ data }, { headers: privateHeaders() });
}

export async function PATCH(request: Request) {
  // Keep the endpoint closed before touching session or database state.
  if (!isCampaignVisibilityAdminEnabled()) return error("Not found", 404);
  if (!isSameOriginMutation(request.url, request.headers.get("origin"))) {
    return error("Invalid origin", 403);
  }

  const access = await requireAdmin();
  if (access instanceof Response) return access;

  const parsed = parseCampaignVisibilityMutation(
    await request.json().catch(() => null),
  );
  if (!parsed.ok) return error(parsed.message, 400);

  try {
    const result = await withDbTransaction((client) =>
      mutateCampaignVisibility(client, access.authUserId, parsed.value),
    );
    let cacheInvalidated = result.changed === 0;
    if (result.changed > 0) {
      try {
        revalidateTag(PUBLIC_CAMPAIGN_CACHE_TAG, { expire: 0 });
        cacheInvalidated = true;
      } catch {
        console.error("[Re:Place] public campaign cache invalidation failed");
      }
    }
    return Response.json(
      { data: result, cacheInvalidated },
      { headers: privateHeaders() },
    );
  } catch (caught) {
    if (caught instanceof CampaignVisibilityConflictError) {
      return error("The selected data changed. Refresh and try again.", 409);
    }
    if (caught instanceof CampaignVisibilityNotFoundError) {
      return error("The selected data no longer exists.", 404);
    }
    console.error("[Re:Place] campaign visibility mutation failed");
    return error("Campaign visibility update failed", 500);
  }
}
