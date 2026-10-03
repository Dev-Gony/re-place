import { redirect } from "next/navigation";

import { auth } from "../../lib/auth/server";
import { loadWorkspace } from "../../lib/workspace-data";
import { seoulDateKey } from "../../lib/task-date";
import { WebHeader } from "../web-header";
import { CalendarWorkspace } from "./calendar-workspace";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in?callbackURL=/calendar");
  }

  const workspace = await loadWorkspace(session.user.id);

  return (
    <main className="calendar-page final-web-page">
      <WebHeader active="calendar" />
      <CalendarWorkspace
        initialTasks={workspace.tasks}
        records={workspace.records}
        todayKey={seoulDateKey(new Date()) ?? "1970-01-01"}
      />
    </main>
  );
}
