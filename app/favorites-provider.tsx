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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (session.isPending) return;

    if (!session.data?.user) {
      setIds(new Set());
      setReady(true);
      return;
    }

    let cancelled = false;

    fetch("/api/private/favorites", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        setIds(new Set((data?.campaignIds ?? []).map(Number)));
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
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
      const response = await fetch(
        currentlyFavorited
          ? `/api/private/favorites?campaignId=${campaignId}`
          : "/api/private/favorites",
        currentlyFavorited
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ campaignId }),
            },
      );

      if (!response.ok) return currentlyFavorited;

      setIds((previous) => {
        const next = new Set(previous);
        if (currentlyFavorited) next.delete(campaignId);
        else next.add(campaignId);
        return next;
      });

      return !currentlyFavorited;
    },
    [ids, router, session.data?.user],
  );

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
