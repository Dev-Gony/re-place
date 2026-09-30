import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "../../lib/auth/server";
import { queryDb } from "../../lib/db";
import { AuthStatus } from "../auth-status";
import { MyWorkspace } from "./my-workspace";
import type { FavoriteItem, RecordItem, TaskItem } from "./my-workspace";
import type { SettlementItem } from "./settlement-section";

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

  const [favoritesResult, recordsResult, tasksResult, settlementsResult] = await Promise.all([
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
    queryDb<TaskItem>(
      `select t.id, t.record_id, t.task_type, t.title,
              t.due_at::text as due_at,
              t.completed_at::text as completed_at,
              r.title as record_title,
              r.platform as record_platform
         from user_campaign_tasks t
         join user_campaign_records r
           on r.id = t.record_id
          and r.auth_user_id = t.auth_user_id
        where t.auth_user_id = $1
        order by
          case when t.completed_at is null then 0 else 1 end,
          t.due_at asc,
          t.created_at desc`,
      [session.user.id],
    ),
    queryDb<SettlementItem>(
      `select
          r.id as record_id,
          r.title as record_title,
          r.platform as record_platform,
          r.status as record_status,
          s.expected_cash_amount,
          s.expected_provided_value_amount,
          s.expected_points_amount,
          s.expected_reimbursement_amount,
          s.actual_cash_received_amount,
          s.actual_reimbursement_received_amount,
          s.cash_received_at::text as cash_received_at,
          s.reimbursement_received_at::text as reimbursement_received_at,
          s.note,
          c.cash_fee_amount as source_cash_amount,
          c.provided_value_amount as source_provided_value_amount,
          c.points_amount as source_points_amount,
          c.reimbursement_amount as source_reimbursement_amount
         from user_campaign_records r
         left join user_campaign_settlements s
           on s.record_id = r.id
          and s.auth_user_id = r.auth_user_id
         left join campaigns c
           on c.id = r.campaign_id
        where r.auth_user_id = $1
          and r.status <> 'cancelled'
        order by
          case when r.status = 'completed' then 1 else 0 end,
          r.updated_at desc`,
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
            <p>{session.user.name || session.user.email} 계정의 찜, 참여 기록, 일정을 관리합니다.</p>
          </div>
          <Link href="/" className="my-find-link">새 캠페인 찾기</Link>
        </div>

        <MyWorkspace
          initialFavorites={favoritesResult.rows}
          initialRecords={recordsResult.rows}
          initialTasks={tasksResult.rows}
          initialSettlements={settlementsResult.rows}
          todayKey={seoulDateKey()}
        />
      </section>
    </main>
  );
}
