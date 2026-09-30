import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "../../lib/auth/server";
import { loadWorkspace } from "../../lib/workspace-data";
import { AuthStatus } from "../auth-status";
import { MyWorkspace } from "./my-workspace";

export const dynamic = "force-dynamic";

function seoulDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "1970-01-01";
}

export default async function MyPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in?callbackURL=/my");
  }

  const workspace = await loadWorkspace(session.user.id);

  return (
    <main className="my-page">
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Re:Place 홈">
            <span className="brand-text">Re:Place</span>
          </Link>
          <nav className="header-nav" aria-label="주요 메뉴">
            <Link href="/">캠페인 찾기</Link>
            <Link href="/my" aria-current="page">내 체험단</Link>
          </nav>
          <div className="header-actions">
            <AuthStatus />
          </div>
        </div>
      </header>

      <section className="my-shell">
        <div className="my-heading">
          <div>
            <h1>내 체험단</h1>
            <p>{session.user.name || session.user.email} 계정의 찜, 참여 기록, 일정을 관리합니다.</p>
          </div>
          <Link href="/" className="my-find-link">새 캠페인 찾기</Link>
        </div>

        <MyWorkspace
          initialFavorites={workspace.favorites}
          initialRecords={workspace.records}
          initialTasks={workspace.tasks}
          initialSettlements={workspace.settlements}
          todayKey={seoulDateKey()}
        />
      </section>
    </main>
  );
}
