export const CAMPAIGN_VISIBILITY_BATCH_LIMIT = 100;

export const CAMPAIGN_PUBLICATION_STATES = [
  "review_pending",
  "published",
  "hidden",
] as const;

export type CampaignPublicationState =
  (typeof CAMPAIGN_PUBLICATION_STATES)[number];

export type CampaignStateMutation = {
  campaignId: string;
  state: CampaignPublicationState;
  expectedVersion: number;
};

export type CampaignVisibilityMutation =
  | {
      kind: "campaigns";
      updates: CampaignStateMutation[];
    }
  | {
      kind: "platform";
      platform: string;
      platformVisible: boolean;
      newCampaignDefault: "review_pending" | "published";
      expectedVersion: number;
    };

export type MutationParseResult =
  | { ok: true; value: CampaignVisibilityMutation }
  | { ok: false; message: string };

const STATE_SET = new Set<string>(CAMPAIGN_PUBLICATION_STATES);
const DEFAULT_SET = new Set(["review_pending", "published"]);

function positiveVersion(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? Number(value)
    : null;
}

function campaignId(value: unknown) {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }
  if (typeof value === "string" && /^[1-9]\d{0,18}$/.test(value)) {
    return value;
  }
  return null;
}

export function parseCampaignVisibilityMutation(
  input: unknown,
): MutationParseResult {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Invalid request body" };
  }

  const body = input as Record<string, unknown>;
  if (body.kind === "campaigns") {
    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return { ok: false, message: "At least one campaign is required" };
    }
    if (body.updates.length > CAMPAIGN_VISIBILITY_BATCH_LIMIT) {
      return {
        ok: false,
        message: `A batch can contain at most ${CAMPAIGN_VISIBILITY_BATCH_LIMIT} campaigns`,
      };
    }

    const updates: CampaignStateMutation[] = [];
    const seen = new Set<string>();
    for (const raw of body.updates) {
      if (!raw || typeof raw !== "object") {
        return { ok: false, message: "Invalid campaign update" };
      }
      const update = raw as Record<string, unknown>;
      const id = campaignId(update.campaignId);
      const version = positiveVersion(update.expectedVersion);
      if (!id || !STATE_SET.has(String(update.state)) || !version) {
        return { ok: false, message: "Invalid campaign update" };
      }
      if (seen.has(id)) {
        return { ok: false, message: "Duplicate campaign id" };
      }
      seen.add(id);
      updates.push({
        campaignId: id,
        state: update.state as CampaignPublicationState,
        expectedVersion: version,
      });
    }
    return { ok: true, value: { kind: "campaigns", updates } };
  }

  if (body.kind === "platform") {
    const platform =
      typeof body.platform === "string" ? body.platform.trim() : "";
    const version = positiveVersion(body.expectedVersion);
    if (
      !platform ||
      platform.length > 120 ||
      typeof body.platformVisible !== "boolean" ||
      !DEFAULT_SET.has(String(body.newCampaignDefault)) ||
      !version
    ) {
      return { ok: false, message: "Invalid platform update" };
    }
    return {
      ok: true,
      value: {
        kind: "platform",
        platform,
        platformVisible: body.platformVisible,
        newCampaignDefault: body.newCampaignDefault as
          | "review_pending"
          | "published",
        expectedVersion: version,
      },
    };
  }

  return { ok: false, message: "Unknown mutation kind" };
}

export function isSameOriginMutation(requestUrl: string, origin: string | null) {
  if (!origin) return false;
  try {
    return new URL(requestUrl).origin === origin;
  } catch {
    return false;
  }
}
