import { queryDb } from "./db";
import {
  WORKSPACE_SCHEMA_VERSION,
  type FavoriteItem,
  type RecordItem,
  type SettlementItem,
  type TaskItem,
  type WorkspaceSnapshot,
} from "./workspace-contract";

export async function loadWorkspace(owner: string): Promise<WorkspaceSnapshot> {
  const [favoritesResult, recordsResult, tasksResult, settlementsResult] =
    await Promise.all([
      queryDb<FavoriteItem>(
        `select id, campaign_id, campaign_snapshot, created_at::text as created_at
           from user_favorites
          where auth_user_id = $1
          order by created_at desc`,
        [owner],
      ),
      queryDb<RecordItem>(
        `select id, campaign_id, source_type, status, title, platform, link,
                reward, region, deadline_at::text as deadline_at, note
           from user_campaign_records
          where auth_user_id = $1
          order by
            case when status in ('completed','cancelled') then 1 else 0 end,
            deadline_at asc nulls last,
            created_at desc`,
        [owner],
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
        [owner],
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
        [owner],
      ),
    ]);

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    syncedAt: new Date().toISOString(),
    favorites: favoritesResult.rows,
    records: recordsResult.rows,
    tasks: tasksResult.rows,
    settlements: settlementsResult.rows,
  };
}
