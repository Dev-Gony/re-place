"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { authClient } from "../lib/auth/client";

type RequestCampaignVisibilityAdminAccess = (
  signal: AbortSignal,
) => Promise<boolean>;

const CampaignVisibilityAdminContext = createContext(false);

export async function requestCampaignVisibilityAdminAccess(
  signal: AbortSignal,
) {
  const response = await fetch("/api/admin/campaign-visibility/access", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (!response.ok) return false;
  const payload = (await response.json()) as { allowed?: unknown };
  return payload.allowed === true;
}

export function CampaignVisibilityAdminAccessProvider({
  children,
  sessionKey,
  pathname,
  requestAccess = requestCampaignVisibilityAdminAccess,
}: {
  children: ReactNode;
  sessionKey: string | null;
  pathname: string;
  requestAccess?: RequestCampaignVisibilityAdminAccess;
}) {
  const [authorizedSessionKey, setAuthorizedSessionKey] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionKey) return;

    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const nextAllowed = await requestAccess(controller.signal);
        if (active) setAuthorizedSessionKey(nextAllowed ? sessionKey : null);
      } catch {
        if (active && !controller.signal.aborted) setAuthorizedSessionKey(null);
      }
    };

    void refresh();
    window.addEventListener("pageshow", refresh);

    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("pageshow", refresh);
    };
  }, [pathname, requestAccess, sessionKey]);

  return (
    <CampaignVisibilityAdminContext.Provider
      value={sessionKey !== null && authorizedSessionKey === sessionKey}
    >
      {children}
    </CampaignVisibilityAdminContext.Provider>
  );
}

export function CampaignVisibilityAdminEntryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const session = authClient.useSession();
  const pathname = usePathname();
  const sessionKey = session.isPending
    ? null
    : (session.data?.session.id ?? null);

  return (
    <CampaignVisibilityAdminAccessProvider
      sessionKey={sessionKey}
      pathname={pathname}
    >
      {children}
    </CampaignVisibilityAdminAccessProvider>
  );
}

export function useCampaignVisibilityAdminEntry() {
  return useContext(CampaignVisibilityAdminContext);
}

export function CampaignVisibilityAdminLink({
  active = false,
  surface,
}: {
  active?: boolean;
  surface: "header" | "account";
}) {
  const allowed = useCampaignVisibilityAdminEntry();
  if (!allowed) return null;

  return (
    <Link
      href="/admin/campaigns"
      className={"campaign-admin-entry " + surface}
      aria-current={active ? "page" : undefined}
    >
      관리자
    </Link>
  );
}
