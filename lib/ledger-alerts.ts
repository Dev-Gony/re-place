// RPL-064: 내 체험단 데이터에서 CampLedger 누락 알림을 계산한다.
// /check 진단과 같은 기준을 저장된 기록에 적용한다. 순수 함수.

import { seoulDateKey } from "./task-date";
import type { RecordItem, SettlementItem, TaskItem } from "./workspace-contract";

export type LedgerAlertKind = "overdue_unpublished" | "payment_overdue" | "payment_unscheduled";

export type LedgerAlert = {
  kind: LedgerAlertKind;
  recordId: number;
  title: string;
  platform: string | null;
  days: number | null;
  amount: number | null;
};

export type LedgerAlertSummary = {
  overdueUnpublished: number;
  paymentOverdue: number;
  paymentUnscheduled: number;
  overdueOutstanding: number;
  alerts: LedgerAlert[];
};

function dayDiff(fromKey: string, toKey: string) {
  return (Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000;
}

const PUBLISH_TASK_TYPES = new Set<TaskItem["task_type"]>(["content", "submit"]);

export function computeLedgerAlerts(
  records: RecordItem[],
  tasks: TaskItem[],
  settlements: SettlementItem[],
  todayKey: string,
): LedgerAlertSummary {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const alerts: LedgerAlert[] = [];

  // 1) 발행 마감이 지났는데 발행 URL이 없고 아직 끝나지 않은 기록
  const overdueByRecord = new Map<number, number>();
  for (const task of tasks) {
    if (task.completed_at || !PUBLISH_TASK_TYPES.has(task.task_type)) continue;
    const record = recordById.get(task.record_id);
    if (!record || record.published_url) continue;
    if (record.status === "completed" || record.status === "cancelled") continue;
    const dueKey = seoulDateKey(task.due_at);
    if (!dueKey) continue;
    const days = dayDiff(todayKey, dueKey);
    if (days < 0) {
      const current = overdueByRecord.get(record.id);
      overdueByRecord.set(record.id, current === undefined ? days : Math.min(current, days));
    }
  }
  for (const [recordId, days] of overdueByRecord) {
    const record = recordById.get(recordId)!;
    alerts.push({
      kind: "overdue_unpublished",
      recordId,
      title: record.title,
      platform: record.platform,
      days,
      amount: null,
    });
  }

  // 2) 현금 지급 예정일이 지났는데 덜 받은 기록, 3) 발행했는데 지급 예정일이 없는 기록
  let overdueOutstanding = 0;
  for (const settlement of settlements) {
    if (settlement.record_status === "cancelled") continue;
    if (settlement.expected_cash_amount === null) continue;
    const outstanding = Math.max(
      settlement.expected_cash_amount - (settlement.actual_cash_received_amount ?? 0),
      0,
    );
    if (outstanding <= 0) continue;

    const record = recordById.get(settlement.record_id);
    const dueKey = settlement.cash_payment_due_at ? seoulDateKey(settlement.cash_payment_due_at) : null;

    if (dueKey) {
      const days = dayDiff(todayKey, dueKey);
      if (days < 0) {
        overdueOutstanding += outstanding;
        alerts.push({
          kind: "payment_overdue",
          recordId: settlement.record_id,
          title: settlement.record_title,
          platform: settlement.record_platform,
          days,
          amount: outstanding,
        });
      }
    } else if (record?.published_url || settlement.record_status === "completed") {
      alerts.push({
        kind: "payment_unscheduled",
        recordId: settlement.record_id,
        title: settlement.record_title,
        platform: settlement.record_platform,
        days: null,
        amount: outstanding,
      });
    }
  }

  const rank: Record<LedgerAlertKind, number> = {
    payment_overdue: 0,
    overdue_unpublished: 1,
    payment_unscheduled: 2,
  };
  alerts.sort((a, b) => rank[a.kind] - rank[b.kind] || (a.days ?? 0) - (b.days ?? 0));

  return {
    overdueUnpublished: alerts.filter((a) => a.kind === "overdue_unpublished").length,
    paymentOverdue: alerts.filter((a) => a.kind === "payment_overdue").length,
    paymentUnscheduled: alerts.filter((a) => a.kind === "payment_unscheduled").length,
    overdueOutstanding,
    alerts,
  };
}
