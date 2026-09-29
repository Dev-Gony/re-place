"use client";

import { UserButton } from "@neondatabase/auth-ui";
import Link from "next/link";

import { authClient } from "../lib/auth/client";

export function AuthStatus() {
  const session = authClient.useSession();

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

  return (
    <div className="header-auth">
      <Link href="/my" className="header-my-link">
        내 체험단
      </Link>
      <UserButton />
    </div>
  );
}
