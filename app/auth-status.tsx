"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "../lib/auth/client";
import { CampaignVisibilityAdminLink } from "./campaign-visibility-admin-entry";

function initials(value: string) {
  const text = value.trim();
  if (!text) return "ME";
  return text.slice(0, 2).toUpperCase();
}

export function AuthStatus() {
  const session = authClient.useSession();
  const router = useRouter();

  if (session.isPending) {
    return <span className="auth-status-loading">확인 중</span>;
  }

  if (!session.data?.user) {
    return (
      <Link className="header-auth-link" href="/auth/sign-in">
        로그인
      </Link>
    );
  }

  const user = session.data.user;
  const label = user.name || user.email?.split("@")[0] || "내 계정";
  const email = user.email || "";

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <details className="account-menu">
      <summary className="account-menu-trigger" aria-label="계정 메뉴 열기">
        <span className="account-avatar">{initials(label)}</span>
        <span className="account-label">{label}</span>
        <span className="account-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="account-menu-popover">
        <div className="account-menu-identity">
          <strong>{label}</strong>
          {email && <span>{email}</span>}
        </div>
        <Link href="/my#favorites">찜목록</Link>
        <Link href="/my">내 체험단</Link>
        <Link href="/calendar">캘린더</Link>
        <CampaignVisibilityAdminLink surface="account" />
        <button type="button" onClick={signOut}>로그아웃</button>
      </div>
    </details>
  );
}
