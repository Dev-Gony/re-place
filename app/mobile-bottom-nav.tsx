"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  key: "discover" | "analysis" | "workspace" | "schedule" | "favorites";
};

const ITEMS: NavItem[] = [
  { href: "/", label: "탐색", key: "discover" },
  { href: "/blog-analysis", label: "분석", key: "analysis" },
  { href: "/my", label: "내 체험단", key: "workspace" },
  { href: "/calendar", label: "일정", key: "schedule" },
  { href: "/my#favorites", label: "찜", key: "favorites" },
];

function Icon({ type }: { type: NavItem["key"] }) {
  if (type === "discover") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
    );
  }

  if (type === "analysis") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19V10M10 19V5M15 19v-7M20 19V8" />
      </svg>
    );
  }

  if (type === "workspace") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    );
  }

  if (type === "schedule") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16M8 14h3M13 14h3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-7-4.1-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.9-7 10-7 10Z" />
    </svg>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname === "/offline"
  ) {
    return null;
  }

  function isActive(item: NavItem) {
    if (item.key === "discover") return pathname === "/";
    if (item.key === "analysis") return pathname === "/blog-analysis";
    if (pathname !== "/my") return false;
    if (item.key === "schedule") return hash === "#schedule";
    if (item.key === "favorites") return hash === "#favorites";
    if (item.key === "workspace") {
      return hash !== "#schedule" && hash !== "#favorites";
    }
    return false;
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴">
      {ITEMS.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <Icon type={item.key} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
