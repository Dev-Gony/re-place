import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "../../lib/auth/server";
import { queryDb } from "../../lib/db";
import { AuthStatus } from "../auth-status";
import { MyWorkspace } from "./my-workspace";
import type { FavoriteItem, RecordItem } from "./my-workspace";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in?callbackURL=/my");
  }

  const [favoritesResult, recordsResult] = await Promise.all([
    queryDb<FavoriteItem>(
      `select id, campaign_id, campaign_snapshot, created_at::text as created_at
         from user_favorites
        where auth_user_id = $1
        order by created_at desc`,
      [session.user.id],
    ),
    queryDb<RecordItem>(
      `select id, campaign_id, source_type, status, title, platform, link,
              reward, region, deadline_at::text as deadline_at, note, campaign_snapshot,
              created_at::text as created_at, updated_at::text as updated_at
         from user_campaign_records
        where auth_user_id = $1
        order by
          case when status in ('completed','cancelled') then 1 else 0 end,
          deadline_at asc nulls last,
          created_at desc`,
      [session.user.id],
    ),
  ]);

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
            <p>{session.user.name || session.user.email} 계정의 찜과 참여 기록을 관리합니다.</p>
          </div>
          <Link href="/" className="my-find-link">새 캠페인 찾기</Link>
        </div>

        <MyWorkspace
          initialFavorites={favoritesResult.rows}
          initialRecords={recordsResult.rows}
        />
      </section>
    </main>
  );
}
