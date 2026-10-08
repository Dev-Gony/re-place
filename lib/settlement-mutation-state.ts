import type {
  SettlementItem,
  SettlementMutationItem,
} from "./workspace-contract";

export type SettlementDisplayContext = Pick<
  SettlementItem,
  | "record_title"
  | "record_platform"
  | "record_status"
  | "source_cash_amount"
  | "source_provided_value_amount"
  | "source_points_amount"
  | "source_reimbursement_amount"
>;

export function upsertSettlementMutation(
  items: SettlementItem[],
  mutation: SettlementMutationItem,
  context: SettlementDisplayContext,
) {
  const current = items.find((item) => item.record_id === mutation.record_id);
  const next: SettlementItem = {
    ...(current ?? context),
    ...mutation,
  };

  if (!current) return [...items, next];
  return items.map((item) =>
    item.record_id === mutation.record_id ? next : item,
  );
}

export function remainingSettlementAmount(
  expected: number | null,
  actual: number | null,
) {
  if (expected === null) return null;
  return Math.max(expected - (actual ?? 0), 0);
}

export function summarizeSettlements(items: SettlementItem[]) {
  let cash = 0;
  let reimbursement = 0;
  let cashKnown = false;
  let reimbursementKnown = false;
  let cashPending = 0;
  let reimbursementPending = 0;

  for (const item of items) {
    const cashRemaining = remainingSettlementAmount(
      item.expected_cash_amount,
      item.actual_cash_received_amount,
    );
    if (cashRemaining !== null) {
      cashKnown = true;
      cash += cashRemaining;
      if (cashRemaining > 0) cashPending += 1;
    }

    const reimbursementRemaining = remainingSettlementAmount(
      item.expected_reimbursement_amount,
      item.actual_reimbursement_received_amount,
    );
    if (reimbursementRemaining !== null) {
      reimbursementKnown = true;
      reimbursement += reimbursementRemaining;
      if (reimbursementRemaining > 0) reimbursementPending += 1;
    }
  }

  return {
    cash,
    reimbursement,
    cashKnown,
    reimbursementKnown,
    cashPending,
    reimbursementPending,
  };
}
