// RPL-064: 가져오기 요청 검증. 브라우저 진단 결과를 믿지 않고 서버에서 다시 검사한다.
// DB를 사용하지 않는 순수 함수라 단위 테스트로 고정한다.

import {
  normalizeOptionalDeadline,
  normalizeOptionalText,
  normalizePublishedUrl,
} from "./private-data";

export const IMPORT_MAX_ITEMS = 200;
const IMPORT_STATUSES = new Set(["selected", "completed", "cancelled"]);
const MAX_AMOUNT = 2_147_483_647;

export type ValidImportItem = {
  title: string;
  platform: string | null;
  status: "selected" | "completed" | "cancelled";
  deadlineAt: string | null;
  publishedUrl: string | null;
  expectedCashAmount: number | null;
  actualCashReceivedAmount: number | null;
  cashPaymentDueAt: string | null;
  note: string | null;
};

export type ImportValidation =
  | { ok: true; items: ValidImportItem[]; skipped: number[] }
  | { ok: false; message: string };

function amount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > MAX_AMOUNT) {
    return undefined;
  }
  return number;
}

/**
 * 요청 본문을 검증한다. 형식이 틀린 행은 전체를 거부하지 않고 건너뛴 행 번호로 돌려준다.
 * 본문 구조 자체가 틀리면 전체를 거부한다.
 */
export function validateLedgerImport(body: unknown): ImportValidation {
  if (!body || typeof body !== "object" || !Array.isArray((body as { items?: unknown }).items)) {
    return { ok: false, message: "items must be an array" };
  }

  const raw = (body as { items: unknown[] }).items;
  if (raw.length === 0) return { ok: false, message: "items must not be empty" };
  if (raw.length > IMPORT_MAX_ITEMS) {
    return { ok: false, message: `items must be ${IMPORT_MAX_ITEMS} or fewer` };
  }

  const items: ValidImportItem[] = [];
  const skipped: number[] = [];

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      skipped.push(index);
      return;
    }
    const value = entry as Record<string, unknown>;
    const title = normalizeOptionalText(value.title, 240);
    const status =
      typeof value.status === "string" && IMPORT_STATUSES.has(value.status)
        ? (value.status as ValidImportItem["status"])
        : null;
    const deadlineAt = normalizeOptionalDeadline(value.deadlineAt);
    const cashPaymentDueAt = normalizeOptionalDeadline(value.paymentDueAt);
    const publishedUrl = normalizePublishedUrl(value.publishedUrl);
    const expectedCashAmount = amount(value.expectedCashAmount);
    const actualCashReceivedAmount = amount(value.actualCashReceivedAmount);

    if (
      !title ||
      !status ||
      deadlineAt === undefined ||
      cashPaymentDueAt === undefined ||
      publishedUrl === undefined ||
      expectedCashAmount === undefined ||
      actualCashReceivedAmount === undefined
    ) {
      skipped.push(index);
      return;
    }

    items.push({
      title,
      platform: normalizeOptionalText(value.platform, 80),
      status,
      deadlineAt,
      publishedUrl,
      expectedCashAmount,
      actualCashReceivedAmount,
      cashPaymentDueAt,
      note: normalizeOptionalText(value.note, 4000),
    });
  });

  if (items.length === 0) {
    return { ok: false, message: "No valid items to import" };
  }

  return { ok: true, items, skipped };
}
