export const CAMPAIGN_VISIBILITY_SCOPE = "campaign_visibility" as const;

export type CampaignVisibilitySessionUser = {
  id?: string | null;
  emailVerified?: boolean | null;
};

export type CampaignVisibilityAccess =
  | { allowed: true; authUserId: string }
  | {
      allowed: false;
      reason:
        | "feature_disabled"
        | "unauthenticated"
        | "email_unverified"
        | "forbidden";
    };

type RoleQuery = (
  text: string,
  values: readonly unknown[],
) => Promise<{ rows: readonly unknown[] }>;

export function isCampaignVisibilityAdminEnabled(
  value = process.env.CAMPAIGN_VISIBILITY_ADMIN_ENABLED,
) {
  return value === "true";
}

export async function authorizeCampaignVisibilityAdmin({
  enabled,
  user,
  queryRole,
}: {
  enabled: boolean;
  user: CampaignVisibilitySessionUser | null | undefined;
  queryRole: RoleQuery;
}): Promise<CampaignVisibilityAccess> {
  if (!enabled) return { allowed: false, reason: "feature_disabled" };
  if (!user?.id) return { allowed: false, reason: "unauthenticated" };
  if (user.emailVerified !== true) {
    return { allowed: false, reason: "email_unverified" };
  }

  const result = await queryRole(
    `select 1
       from public.campaign_admin_roles
      where auth_user_id = $1
        and scope = $2
        and active = true
      limit 1`,
    [user.id, CAMPAIGN_VISIBILITY_SCOPE],
  );

  if (result.rows.length === 0) {
    return { allowed: false, reason: "forbidden" };
  }

  return { allowed: true, authUserId: user.id };
}
