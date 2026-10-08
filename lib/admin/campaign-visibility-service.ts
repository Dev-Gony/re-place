import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";

import type {
  CampaignStateMutation,
  CampaignVisibilityMutation,
} from "./campaign-visibility-contract";

export class CampaignVisibilityConflictError extends Error {}
export class CampaignVisibilityNotFoundError extends Error {}

type Client = Pick<PoolClient, "query">;

type CurrentCampaignRow = QueryResultRow & {
  campaign_id: string;
  state: string;
  version: string | number;
  updated_at: string;
};

type UpdatedCampaignRow = QueryResultRow & {
  campaign_id: string;
  state: string;
  version: string | number;
  updated_at: string;
};

type CurrentPlatformRow = QueryResultRow & {
  platform: string;
  platform_visible: boolean;
  new_campaign_default: string;
  version: string | number;
};

type UpdatedPlatformRow = QueryResultRow & {
  platform: string;
  platform_visible: boolean;
  new_campaign_default: string;
  version: string | number;
  updated_at: string;
};

function sameVersion(actual: string | number, expected: number) {
  return Number(actual) === expected;
}

function sortedCampaignUpdates(updates: CampaignStateMutation[]) {
  return [...updates].sort((left, right) => {
    const a = BigInt(left.campaignId);
    const b = BigInt(right.campaignId);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

export async function mutateCampaignVisibility(
  client: Client,
  actorAuthUserId: string,
  mutation: CampaignVisibilityMutation,
) {
  const batchId = randomUUID();

  if (mutation.kind === "platform") {
    const currentResult = await client.query<CurrentPlatformRow>(
      `select platform, platform_visible, new_campaign_default, version
         from public.campaign_publication_policies
        where platform = $1
        for update`,
      [mutation.platform],
    );
    const current = currentResult.rows[0];
    if (!current) throw new CampaignVisibilityNotFoundError("Platform not found");
    if (!sameVersion(current.version, mutation.expectedVersion)) {
      throw new CampaignVisibilityConflictError("Platform was changed");
    }

    if (
      current.platform_visible === mutation.platformVisible &&
      current.new_campaign_default === mutation.newCampaignDefault
    ) {
      return { kind: "platform" as const, item: current, batchId, changed: 0 };
    }

    const updatedResult = await client.query<UpdatedPlatformRow>(
      `update public.campaign_publication_policies
          set platform_visible = $2,
              new_campaign_default = $3,
              version = version + 1,
              updated_by = $4,
              updated_at = now()
        where platform = $1
          and version = $5
      returning platform, platform_visible, new_campaign_default, version,
                updated_at::text as updated_at`,
      [
        mutation.platform,
        mutation.platformVisible,
        mutation.newCampaignDefault,
        actorAuthUserId,
        mutation.expectedVersion,
      ],
    );
    const updated = updatedResult.rows[0];
    if (!updated) throw new CampaignVisibilityConflictError("Platform was changed");

    await client.query(
      `insert into public.campaign_publication_audit (
         target_type, platform, action, previous_value, next_value,
         actor_auth_user_id, batch_id
       ) values (
         'platform', $1, 'platform_policy_changed',
         jsonb_build_object(
           'platformVisible', $2::boolean,
           'newCampaignDefault', $3::text,
           'version', $4::bigint
         ),
         jsonb_build_object(
           'platformVisible', $5::boolean,
           'newCampaignDefault', $6::text,
           'version', $7::bigint
         ),
         $8, $9
       )`,
      [
        mutation.platform,
        current.platform_visible,
        current.new_campaign_default,
        current.version,
        updated.platform_visible,
        updated.new_campaign_default,
        updated.version,
        actorAuthUserId,
        batchId,
      ],
    );

    return { kind: "platform" as const, item: updated, batchId, changed: 1 };
  }

  const updates = sortedCampaignUpdates(mutation.updates);
  const currentRows = new Map<string, CurrentCampaignRow>();

  // Lock and validate the complete batch before the first write.
  for (const update of updates) {
    const currentResult = await client.query<CurrentCampaignRow>(
      `select campaign_id::text as campaign_id, state, version,
              updated_at::text as updated_at
         from public.campaign_publication_states
        where campaign_id = $1
        for update`,
      [update.campaignId],
    );
    const current = currentResult.rows[0];
    if (!current) {
      throw new CampaignVisibilityNotFoundError("Campaign state not found");
    }
    if (!sameVersion(current.version, update.expectedVersion)) {
      throw new CampaignVisibilityConflictError("Campaign was changed");
    }
    currentRows.set(update.campaignId, current);
  }

  const items: UpdatedCampaignRow[] = [];
  let changed = 0;
  for (const update of updates) {
    const current = currentRows.get(update.campaignId)!;
    if (current.state === update.state) {
      items.push({
        campaign_id: current.campaign_id,
        state: current.state,
        version: current.version,
        updated_at: current.updated_at,
      });
      continue;
    }

    const updatedResult = await client.query<UpdatedCampaignRow>(
      `update public.campaign_publication_states
          set state = $2,
              version = version + 1,
              updated_by = $3,
              updated_at = now()
        where campaign_id = $1
          and version = $4
      returning campaign_id::text as campaign_id, state, version,
                updated_at::text as updated_at`,
      [
        update.campaignId,
        update.state,
        actorAuthUserId,
        update.expectedVersion,
      ],
    );
    const updated = updatedResult.rows[0];
    if (!updated) throw new CampaignVisibilityConflictError("Campaign was changed");

    await client.query(
      `insert into public.campaign_publication_audit (
         target_type, campaign_id, action, previous_value, next_value,
         actor_auth_user_id, batch_id
       ) values (
         'campaign', $1, 'campaign_state_changed',
         jsonb_build_object('state', $2::text, 'version', $3::bigint),
         jsonb_build_object('state', $4::text, 'version', $5::bigint),
         $6, $7
       )`,
      [
        update.campaignId,
        current.state,
        current.version,
        updated.state,
        updated.version,
        actorAuthUserId,
        batchId,
      ],
    );
    changed += 1;
    items.push(updated);
  }

  return { kind: "campaigns" as const, items, batchId, changed };
}
