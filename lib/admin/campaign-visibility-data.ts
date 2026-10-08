import { queryDb } from "../db";
import type { CampaignPublicationState } from "./campaign-visibility-contract";

export type CampaignVisibilityFilters = {
  q?: string;
  platform?: string;
  state?: CampaignPublicationState | "all";
};

export type CampaignPolicyItem = {
  platform: string;
  platform_visible: boolean;
  new_campaign_default: "review_pending" | "published";
  version: number;
  updated_at: string;
};

export type CampaignVisibilityItem = {
  id: string;
  platform: string;
  title: string;
  state: CampaignPublicationState;
  version: number;
  updated_at: string;
};

export type CampaignAuditItem = {
  id: string;
  target_type: "platform" | "campaign";
  target_label: string;
  action: string;
  previous_value: Record<string, unknown> | null;
  next_value: Record<string, unknown>;
  actor_auth_user_id: string;
  created_at: string;
};

export type CampaignVisibilityAdminData = {
  policies: CampaignPolicyItem[];
  campaigns: CampaignVisibilityItem[];
  audits: CampaignAuditItem[];
  matchingCount: number;
};

export async function loadCampaignVisibilityAdminData(
  filters: CampaignVisibilityFilters = {},
): Promise<CampaignVisibilityAdminData> {
  const q = filters.q?.trim().slice(0, 100) ?? "";
  const platform = filters.platform?.trim().slice(0, 120) ?? "";
  const state = filters.state && filters.state !== "all" ? filters.state : "";
  const values: unknown[] = [];
  const where: string[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (q) {
    const token = bind(`%${q}%`);
    where.push(`(c.title ilike ${token} or c.platform ilike ${token})`);
  }
  if (platform) where.push(`c.platform = ${bind(platform)}`);
  if (state) where.push(`publication.state = ${bind(state)}`);
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const [policyResult, campaignResult, countResult, auditResult] =
    await Promise.all([
      queryDb<CampaignPolicyItem>(
        `select platform, platform_visible, new_campaign_default,
                version::int as version, updated_at::text as updated_at
           from public.campaign_publication_policies
          order by platform`,
      ),
      queryDb<CampaignVisibilityItem>(
        `select c.id::text as id,
                coalesce(c.platform, '') as platform,
                coalesce(c.title, '') as title,
                publication.state,
                publication.version::int as version,
                publication.updated_at::text as updated_at
           from public.campaigns c
           join public.campaign_publication_states publication
             on publication.campaign_id = c.id
          ${whereSql}
          order by c.id desc
          limit 50`,
        values,
      ),
      queryDb<{ count: number }>(
        `select count(*)::int as count
           from public.campaigns c
           join public.campaign_publication_states publication
             on publication.campaign_id = c.id
          ${whereSql}`,
        values,
      ),
      queryDb<CampaignAuditItem>(
        `select id::text as id,
                target_type,
                coalesce(platform, campaign_id::text, '-') as target_label,
                action,
                previous_value,
                next_value,
                actor_auth_user_id::text as actor_auth_user_id,
                created_at::text as created_at
           from public.campaign_publication_audit
          order by id desc
          limit 30`,
      ),
    ]);

  return {
    policies: policyResult.rows,
    campaigns: campaignResult.rows,
    audits: auditResult.rows,
    matchingCount: countResult.rows[0]?.count ?? 0,
  };
}
