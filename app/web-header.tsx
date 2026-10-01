import Link from "next/link";

import { AuthStatus } from "./auth-status";

type WebHeaderProps = {
  active: "explore" | "my" | "calendar" | "analysis";
};

const NAV_ITEMS = [
  { key: "explore", href: "/", label: "탐색" },
  { key: "my", href: "/my", label: "내 체험단" },
  { key: "calendar", href: "/calendar", label: "캘린더" },
  { key: "analysis", href: "/blog-analysis", label: "블로그 분석" },
] as const;

export function WebHeader({ active }: WebHeaderProps) {
  return (
    <header className="web-header">
      <div className="web-header-inner">
        <div className="web-brand-nav">
          <Link href="/" className="web-brand" aria-label="Re:Place 홈">
            <span className="web-brand-mark" aria-hidden="true" />
            <span>Re:Place</span>
          </Link>

          <nav className="web-nav" aria-label="주요 메뉴">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active === item.key ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="web-header-actions">
          <AuthStatus />
        </div>
      </div>
    </header>
  );
}
