"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { authClient } from "../lib/auth/client";
import {
  FAVORITE_STATE_EVENT,
  type FavoriteStateDetail,
} from "../lib/favorite-events";
import {
  addFavorite,
  createRecord,
  getWorkspace,
  removeFavorite,
} from "../lib/workspace-client";

type FavoritesContextValue = {
  ready: boolean;
  loggedIn: boolean;
  ids: Set<number>;
  recordIds: Set<number>;
  toggle: (campaignId: number) => Promise<boolean>;
  addToMyCampaign: (campaignId: number) => Promise<"added" | "existing" | "login" | "error">;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const router = useRouter();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [recordIds, setRecordIds] = useState<Set<number>>(new Set());
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (session.isPending) return;

    if (!session.data?.user) return;

    let cancelled = false;

    getWorkspace()
      .then((data) => {
        if (cancelled) return;
        setIds(new Set(data.favorites.map((item) => Number(item.campaign_id))));
        setRecordIds(
          new Set(
            data.records
              .map((item) => item.campaign_id)
              .filter((value): value is number => typeof value === "number"),
          ),
        );
        setLoadedUserId(session.data?.user?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadedUserId(session.data?.user?.id ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [session.data?.user, session.isPending]);

  useEffect(() => {
    function syncFavoriteState(event: Event) {
      const { campaignId, favorited } = (
        event as CustomEvent<FavoriteStateDetail>
      ).detail;

      setIds((previous) => {
        const next = new Set(previous);
        if (favorited) next.add(campaignId);
        else next.delete(campaignId);
        return next;
      });
    }

    window.addEventListener(FAVORITE_STATE_EVENT, syncFavoriteState);
    return () => window.removeEventListener(FAVORITE_STATE_EVENT, syncFavoriteState);
  }, []);

  const toggle = useCallback(
    async (campaignId: number) => {
      if (!session.data?.user) {
        router.push("/auth/sign-in");
        return false;
      }

      const currentlyFavorited = ids.has(campaignId);

      try {
        if (currentlyFavorited) {
          await removeFavorite(campaignId);
        } else {
          await addFavorite(campaignId);
        }

        setIds((previous) => {
          const next = new Set(previous);
          if (currentlyFavorited) next.delete(campaignId);
          else next.add(campaignId);
          return next;
        });

        return !currentlyFavorited;
      } catch {
        return currentlyFavorited;
      }
    },
    [ids, router, session.data?.user],
  );

  const addToMyCampaign = useCallback(
    async (campaignId: number) => {
      if (!session.data?.user) {
        router.push("/auth/sign-in?callbackURL=/");
        return "login" as const;
      }

      if (recordIds.has(campaignId)) {
        return "existing" as const;
      }

      try {
        await createRecord({ campaignId });
        setRecordIds((previous) => {
          const next = new Set(previous);
          next.add(campaignId);
          return next;
        });
        return "added" as const;
      } catch {
        return "error" as const;
      }
    },
    [recordIds, router, session.data?.user],
  );

  const ready =
    !session.isPending &&
    (!session.data?.user || loadedUserId === session.data.user.id);

  const value = useMemo(
    () => ({
      ready,
      loggedIn: Boolean(session.data?.user),
      ids,
      recordIds,
      toggle,
      addToMyCampaign,
    }),
    [ready, session.data?.user, ids, recordIds, toggle, addToMyCampaign],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) {
    throw new Error("useFavorites must be used inside FavoritesProvider");
  }
  return value;
}
