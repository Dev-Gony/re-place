import { auth } from "../auth/server";
import { queryDb } from "../db";
import {
  authorizeCampaignVisibilityAdmin,
  isCampaignVisibilityAdminEnabled,
} from "./campaign-visibility-access";

export async function currentCampaignVisibilityAdmin() {
  const enabled = isCampaignVisibilityAdminEnabled();
  if (!enabled) {
    return { allowed: false as const, reason: "feature_disabled" as const };
  }

  const { data: session } = await auth.getSession();
  return authorizeCampaignVisibilityAdmin({
    enabled,
    user: session?.user,
    queryRole: (text, values) => queryDb(text, values),
  });
}
