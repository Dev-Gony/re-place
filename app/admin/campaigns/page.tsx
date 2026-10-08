import { notFound, redirect } from "next/navigation";

import { isCampaignVisibilityAdminEnabled } from "../../../lib/admin/campaign-visibility-access";
import type { CampaignPublicationState } from "../../../lib/admin/campaign-visibility-contract";
import { loadCampaignVisibilityAdminData } from "../../../lib/admin/campaign-visibility-data";
import { currentCampaignVisibilityAdmin } from "../../../lib/admin/campaign-visibility-server";
import { WebHeader } from "../../web-header";
import { CampaignVisibilityAdmin } from "./campaign-visibility-admin";
import styles from "./campaigns.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CampaignAdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Do not read session or role tables while the feature is closed.
  if (!isCampaignVisibilityAdminEnabled()) notFound();

  const access = await currentCampaignVisibilityAdmin();
  if (!access.allowed) {
    if (access.reason === "unauthenticated") {
      redirect("/auth/sign-in?callbackURL=/admin/campaigns");
    }
    notFound();
  }

  const resolved = await searchParams;
  const rawState = first(resolved.state);
  const state = ["review_pending", "published", "hidden"].includes(rawState)
    ? (rawState as CampaignPublicationState)
    : "all";
  const filters = {
    q: first(resolved.q).slice(0, 100),
    platform: first(resolved.platform).slice(0, 120),
    state,
  } as const;
  const data = await loadCampaignVisibilityAdminData(filters);

  return (
    <main className={styles.page}>
      <WebHeader active="admin" />
      <CampaignVisibilityAdmin initialData={data} filters={filters} />
    </main>
  );
}
