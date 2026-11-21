// RPL-063/064: 무료 진단 결과를 로그인 후 내 체험단으로 넘기는 브라우저 측 연결.
// sessionStorage에만 잠시 보관하고 서버에는 사용자가 가져오기를 누를 때만 보낸다.

import { isDuplicateRow, type LedgerRow } from "./ledger-diagnosis";

export const LEDGER_IMPORT_STORAGE_KEY = "replace:ledger-import:v1";
export const LEDGER_IMPORT_MAX_ROWS = 200;
const STASH_TTL_MS = 6 * 60 * 60 * 1000;

export type LedgerImportItem = {
  sheetRow: number;
  title: string;
  platform: string | null;
  status: "selected" | "completed" | "cancelled";
  deadlineAt: string | null;
  publishedUrl: string | null;
  expectedCashAmount: number | null;
  actualCashReceivedAmount: number | null;
  paymentDueAt: string | null;
  cashReceived: boolean;
  note: string | null;
};

type StoredImport = {
  savedAt: number;
  todayKey: string;
  items: LedgerImportItem[];
};

/** 중복 의심 행은 같은 캠페인이 두 번 들어가지 않도록 가져오지 않는다. */
export function toImportItems(rows: LedgerRow[]): LedgerImportItem[] {
  return rows.filter((row) => !isDuplicateRow(row)).slice(0, LEDGER_IMPORT_MAX_ROWS).map((row) => {
    const status: LedgerImportItem["status"] = row.cancelled
      ? "cancelled"
      : row.publishState !== "none"
        ? "completed"
        : "selected";
    const noteParts = [
      row.provided ? `제공: ${row.provided}` : null,
      row.publishState === "memo" && row.publishedRaw ? `발행 메모: ${row.publishedRaw}` : null,
      row.note,
      !row.paymentDue && row.paymentDueRaw ? `지급 예정일 원문: ${row.paymentDueRaw}` : null,
      !row.deadline && row.deadlineRaw ? `마감 원문: ${row.deadlineRaw}` : null,
    ].filter(Boolean);

    const paid = row.paidState === "paid";
    const received =
      row.receivedCash ?? (paid && typeof row.expectedCash === "number" ? row.expectedCash : null);

    return {
      sheetRow: row.sheetRow,
      title: row.title.slice(0, 240),
      platform: row.platform ? row.platform.slice(0, 80) : null,
      status,
      deadlineAt: row.deadline,
      publishedUrl: row.publishedUrl,
      expectedCashAmount: row.expectedCash,
      actualCashReceivedAmount: received,
      paymentDueAt: row.paymentDue,
      cashReceived: paid,
      note: noteParts.length ? noteParts.join(" / ").slice(0, 4000) : null,
    };
  });
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function stashLedgerImport(rows: LedgerRow[], todayKey: string): boolean {
  const store = storage();
  if (!store) return false;
  const payload: StoredImport = {
    savedAt: Date.now(),
    todayKey,
    items: toImportItems(rows),
  };
  try {
    store.setItem(LEDGER_IMPORT_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadLedgerImport(now = Date.now()): LedgerImportItem[] | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(LEDGER_IMPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredImport;
    if (!parsed || !Array.isArray(parsed.items) || now - parsed.savedAt > STASH_TTL_MS) {
      store.removeItem(LEDGER_IMPORT_STORAGE_KEY);
      return null;
    }
    return parsed.items;
  } catch {
    return null;
  }
}

export function clearLedgerImport() {
  try {
    storage()?.removeItem(LEDGER_IMPORT_STORAGE_KEY);
  } catch {
    // 저장소 접근이 막혀 있어도 화면 동작에는 영향이 없다.
  }
}
