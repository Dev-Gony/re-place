"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { authClient } from "../lib/auth/client";
import { FavoritesProvider } from "./favorites-provider";
import { CampaignVisibilityAdminEntryProvider } from "./campaign-visibility-admin-entry";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      emailOTP
      redirectTo="/my"
      Link={Link}
    >
      <CampaignVisibilityAdminEntryProvider>
        <FavoritesProvider>{children}</FavoritesProvider>
      </CampaignVisibilityAdminEntryProvider>
    </NeonAuthUIProvider>
  );
}
