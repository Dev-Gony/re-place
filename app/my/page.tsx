import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "../../lib/auth/server";
import { queryDb } from "../../lib/db";
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
      <header className="my-page-header">
        <Link href="/" className="brand" aria-label="Re:Place 홈">
          <span className="brand-mark">R</span>
          <span className="brand-text">Re:Place</span>
        </Link>
        <Link href="/">캠페인 찾기</Link>
      </header>

      <section className="my-page-hero">
        <span>MY RE:PLACE</span>
        <h1>{session.user.name || session.user.email}님의 체험단 관리</h1>
        <p>
          찜한 캠페인을 모으고, 지원·선정·방문·리뷰 완료까지 직접 관리하세요.
        </p>
      </section>

      <MyWorkspace
        initialFavorites={favoritesResult.rows}
        initialRecords={recordsResult.rows}
      />
    </main>
  );
}
