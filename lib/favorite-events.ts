export const FAVORITE_STATE_EVENT = "re-place:favorite-state";

export type FavoriteStateDetail = {
  campaignId: number;
  favorited: boolean;
};

export function announceFavoriteState(detail: FavoriteStateDetail) {
  window.dispatchEvent(
    new window.CustomEvent<FavoriteStateDetail>(FAVORITE_STATE_EVENT, { detail }),
  );
}
