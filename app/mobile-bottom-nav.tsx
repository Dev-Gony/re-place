"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCampaignVisibilityAdminEntry } from "./campaign-visibility-admin-entry";

type NavItem = {
  href: string;
  label: string;
  key: "discover" | "favorites" | "workspace" | "schedule" | "analysis" | "admin";
};

const ITEMS: NavItem[] = [
  { href: "/", label: "탐색", key: "discover" },
  { href: "/my#favorites", label: "찜목록", key: "favorites" },
  { href: "/my", label: "내 체험단", key: "workspace" },
  { href: "/calendar", label: "일정", key: "schedule" },
  { href: "/blog-analysis", label: "분석", key: "analysis" },
];

const ADMIN_ITEM: NavItem = { href: "/admin/campaigns", label: "관리자", key: "admin" };

function Icon({ type }: { type: NavItem["key"] }) {
  if (type === "discover") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
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
  if (type === "favorites") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.2 4.7 13A4.8 4.8 0 0 1 11.5 6.2L12 6.7l.5-.5A4.8 4.8 0 0 1 19.3 13Z" />
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
  if (type === "admin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 5 6v5c0 4.6 2.9 8.2 7 10 4.1-1.8 7-5.4 7-10V6Z" />
        <path d="M9.5 12.2 11.2 14l3.6-4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19V10M10 19V5M15 19v-7M20 19V8" />
    </svg>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const canManageCampaignVisibility = useCampaignVisibilityAdminEntry();
  const items = canManageCampaignVisibility ? [...ITEMS, ADMIN_ITEM] : ITEMS;

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
    if (item.key === "favorites") return false;
    if (item.key === "workspace") return pathname === "/my";
    if (item.key === "schedule") return pathname === "/calendar";
    if (item.key === "analysis") return pathname === "/blog-analysis";
    if (item.key === "admin") return pathname.startsWith("/admin/");
    return false;
  }

  return (
    <nav
      className={"mobile-bottom-nav" + (canManageCampaignVisibility ? " has-admin" : "")}
      style={
        canManageCampaignVisibility
          ? { gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }
          : undefined
      }
      aria-label="모바일 주요 메뉴"
    >
      {items.map((item) => {
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
