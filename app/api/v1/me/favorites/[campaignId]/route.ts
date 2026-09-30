import { queryDb } from "../../../../../../lib/db";
import {
  currentOwnerId,
  positiveId,
  v1Error,
  v1Mutation,
} from "../../../../../../lib/workspace-api";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const owner = await currentOwnerId();
  if (!owner) return v1Error("UNAUTHORIZED", "Authentication required", 401);

  const campaignId = positiveId((await params).campaignId);
  if (!campaignId) {
    return v1Error("INVALID_INPUT", "campaignId must be a positive integer", 400);
  }

  await queryDb(
    `delete from user_favorites
      where auth_user_id = $1
        and campaign_id = $2`,
    [owner, campaignId],
  );

  return v1Mutation({ favorited: false, campaignId });
}
