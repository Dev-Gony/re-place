import { withDbTransaction } from "./db";
import type { ValidImportItem } from "./ledger-import-validate";
import type { RecordItem, SettlementItem, TaskItem } from "./workspace-contract";

// RPL-064: 가져오기 저장. 행마다 직접 등록 기록, 현금 정산(있을 때), 발행 마감 일정(있을 때)을
// 한 트랜잭션으로 만들고, 만든 항목을 workspace 계약 형태로 돌려준다.
export async function importLedgerItems(owner: string, items: ValidImportItem[]) {
  return withDbTransaction(async (client) => {
    const records: RecordItem[] = [];
    const tasks: TaskItem[] = [];
    const settlements: SettlementItem[] = [];

    for (const item of items) {
      const snapshot = {
        title: item.title,
        platform: item.platform,
        manual: true,
        imported_from: "ledger-check",
      };

      const recordResult = await client.query<RecordItem>(
        `insert into user_campaign_records (
           auth_user_id, source_type, status, title, platform,
           note, campaign_snapshot, published_url
         )
         values ($1, 'manual', $2, $3, $4, $5, $6::jsonb, $7)
         returning id, campaign_id, source_type, status, title, platform, link,
                   reward, region, deadline_at::text as deadline_at, note,
                   published_url`,
        [
          owner,
          item.status,
          item.title,
          item.platform,
          item.note,
          JSON.stringify(snapshot),
          item.publishedUrl,
        ],
      );
      const record = recordResult.rows[0];
      records.push(record);

      const hasSettlement =
        item.expectedCashAmount !== null ||
        item.actualCashReceivedAmount !== null ||
        item.cashPaymentDueAt !== null;

      let cashPaymentDueAt: string | null = null;
      if (hasSettlement) {
        const settlementResult = await client.query<{ cash_payment_due_at: string | null }>(
          `insert into user_campaign_settlements (
             auth_user_id, record_id, expected_cash_amount,
             actual_cash_received_amount, cash_payment_due_at
           )
           values ($1, $2, $3, $4, $5::timestamptz)
           returning cash_payment_due_at::text as cash_payment_due_at`,
          [
            owner,
            record.id,
            item.expectedCashAmount,
            item.actualCashReceivedAmount,
            item.cashPaymentDueAt,
          ],
        );
        cashPaymentDueAt = settlementResult.rows[0].cash_payment_due_at;
      }

      // 정산 목록은 취소되지 않은 모든 기록을 보여준다 (loadWorkspace와 같은 규칙).
      if (record.status !== "cancelled") {
        settlements.push({
          record_id: record.id,
          record_title: record.title,
          record_platform: record.platform,
          record_status: record.status,
          expected_cash_amount: hasSettlement ? item.expectedCashAmount : null,
          expected_provided_value_amount: null,
          expected_points_amount: null,
          expected_reimbursement_amount: null,
          actual_cash_received_amount: hasSettlement ? item.actualCashReceivedAmount : null,
          actual_reimbursement_received_amount: null,
          cash_received_at: null,
          reimbursement_received_at: null,
          cash_payment_due_at: cashPaymentDueAt,
          note: null,
          source_cash_amount: null,
          source_provided_value_amount: null,
          source_points_amount: null,
          source_reimbursement_amount: null,
        });
      }

      if (item.deadlineAt && item.status !== "cancelled") {
        const taskResult = await client.query<Omit<TaskItem, "record_title" | "record_platform">>(
          `insert into user_campaign_tasks (
             auth_user_id, record_id, task_type, title, due_at, completed_at
           )
           values ($1, $2, 'submit', '발행 마감', $3::timestamptz,
                   case when $4::boolean then now() else null end)
           returning id, record_id, task_type, title,
                     due_at::text as due_at,
                     completed_at::text as completed_at`,
          [owner, record.id, item.deadlineAt, item.status === "completed"],
        );
        tasks.push({
          ...taskResult.rows[0],
          record_title: record.title,
          record_platform: record.platform,
        });
      }
    }

    return { records, tasks, settlements };
  });
}
