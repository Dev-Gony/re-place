export const WORKSPACE_SCHEMA_VERSION = 1 as const;

export type FavoriteItem = {
  id: number;
  campaign_id: number;
  campaign_snapshot: {
    title?: string;
    platform?: string;
    link?: string;
    reward?: string;
    region?: string;
    deadline_at?: string;
  };
  created_at: string;
};

export type RecordItem = {
  id: number;
  campaign_id: number | null;
  source_type: "linked" | "manual";
  status: string;
  title: string;
  platform: string | null;
  link: string | null;
  reward: string | null;
  region: string | null;
  deadline_at: string | null;
  note: string | null;
};

export type TaskItem = {
  id: number;
  record_id: number;
  task_type: "visit" | "content" | "submit" | "other";
  title: string;
  due_at: string;
  completed_at: string | null;
  record_title: string;
  record_platform: string | null;
};

export type SettlementItem = {
  record_id: number;
  record_title: string;
  record_platform: string | null;
  record_status: string;
  expected_cash_amount: number | null;
  expected_provided_value_amount: number | null;
  expected_points_amount: number | null;
  expected_reimbursement_amount: number | null;
  actual_cash_received_amount: number | null;
  actual_reimbursement_received_amount: number | null;
  cash_received_at: string | null;
  reimbursement_received_at: string | null;
  note: string | null;
  source_cash_amount: number | null;
  source_provided_value_amount: number | null;
  source_points_amount: number | null;
  source_reimbursement_amount: number | null;
};

export type WorkspaceSnapshot = {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  syncedAt: string;
  favorites: FavoriteItem[];
  records: RecordItem[];
  tasks: TaskItem[];
  settlements: SettlementItem[];
};
