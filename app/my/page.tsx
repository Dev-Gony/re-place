import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "../../lib/auth/server";
import { loadWorkspace } from "../../lib/workspace-data";
import { seoulDateKey } from "../../lib/task-date";
import { WebHeader } from "../web-header";
import { MyWorkspace } from "./my-workspace";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in?callbackURL=/my");
  }

  const workspace = await loadWorkspace(session.user.id);

  return (
    <main className="my-page">
      <WebHeader active="my" />

      <section className="my-shell my-shell-final">
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
          todayKey={seoulDateKey(new Date()) ?? "1970-01-01"}
        />
      </section>
    </main>
  );
}
