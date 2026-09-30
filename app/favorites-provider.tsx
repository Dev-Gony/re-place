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
  addFavorite,
  getWorkspace,
  removeFavorite,
} from "../lib/workspace-client";

type FavoritesContextValue = {
  ready: boolean;
  loggedIn: boolean;
  ids: Set<number>;
  toggle: (campaignId: number) => Promise<boolean>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const router = useRouter();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (session.isPending) return;

    if (!session.data?.user) return;

    let cancelled = false;

    getWorkspace()
      .then((data) => {
        if (cancelled) return;
        setIds(new Set(data.favorites.map((item) => Number(item.campaign_id))));
        setLoadedUserId(session.data?.user?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadedUserId(session.data?.user?.id ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [session.data?.user, session.isPending]);

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

  const ready =
    !session.isPending &&
    (!session.data?.user || loadedUserId === session.data.user.id);

  const value = useMemo(
    () => ({
      ready,
      loggedIn: Boolean(session.data?.user),
      ids,
      toggle,
    }),
    [ready, session.data?.user, ids, toggle],
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
