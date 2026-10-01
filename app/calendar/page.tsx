import { redirect } from "next/navigation";

import { auth } from "../../lib/auth/server";
import { loadWorkspace } from "../../lib/workspace-data";
import { WebHeader } from "../web-header";
import { CalendarWorkspace } from "./calendar-workspace";

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
        todayKey={seoulDateKey()}
      />
    </main>
  );
}
