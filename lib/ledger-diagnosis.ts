// RPL-063: 로그인 없이 붙여넣은 시트를 브라우저 안에서 정규화하고 누락을 진단한다.
// 이 모듈은 순수 함수만 포함한다. 네트워크 요청이나 저장을 하지 않는다.

export type LedgerField =
  | "title"
  | "platform"
  | "deadline"
  | "publishedUrl"
  | "expectedCash"
  | "receivedCash"
  | "paymentDue"
  | "paid"
  | "status"
  | "provided"
  | "note";

export type FindingKind =
  | "overdue_unpublished"
  | "due_soon_unpublished"
  | "payment_overdue"
  | "payment_partial"
  | "payment_unscheduled"
  | "invalid_url"
  | "duplicate"
  | "unreadable_value";

export type FindingSeverity = "critical" | "warning" | "info";

export type LedgerFinding = {
  kind: FindingKind;
  severity: FindingSeverity;
  detail: string;
  amount?: number;
};

export type PublishState = "url" | "memo" | "none";
export type PaidState = "paid" | "unpaid" | "partial" | null;

export type LedgerRow = {
  /** 시트 기준 행 번호 (헤더 포함, 1부터) */
  sheetRow: number;
  title: string;
  platform: string | null;
  deadline: string | null;
  deadlineRaw: string | null;
  publishedUrl: string | null;
  publishedRaw: string | null;
  publishState: PublishState;
  expectedCash: number | null;
  receivedCash: number | null;
  paymentDue: string | null;
  paymentDueRaw: string | null;
  paidState: PaidState;
  provided: string | null;
  note: string | null;
  cancelled: boolean;
  findings: LedgerFinding[];
};

export type LedgerSummary = {
  totalRows: number;
  activeRows: number;
  cancelledRows: number;
  overdueUnpublished: number;
  dueSoonUnpublished: number;
  paymentOverdue: number;
  overdueOutstanding: number;
  pendingOutstanding: number;
  needsReview: number;
  duplicates: number;
};

export type LedgerDiagnosis =
  | {
      ok: true;
      todayKey: string;
      columns: { field: LedgerField; header: string }[];
      missingFields: LedgerField[];
      rows: LedgerRow[];
      summary: LedgerSummary;
      truncated: boolean;
    }
  | { ok: false; error: string };

export const LEDGER_MAX_ROWS = 500;
export const LEDGER_MAX_CHARS = 200_000;
export const DUE_SOON_DAYS = 3;

export const FIELD_LABELS: Record<LedgerField, string> = {
  title: "캠페인",
  platform: "플랫폼·채널",
  deadline: "발행 마감",
  publishedUrl: "발행 URL",
  expectedCash: "약속 금액",
  receivedCash: "입금액",
  paymentDue: "지급 예정일",
  paid: "정산 여부",
  status: "진행 상태",
  provided: "제공 내역",
  note: "비고",
};

/* ------------------------------------------------------------------ */
/* 표 파싱                                                             */
/* ------------------------------------------------------------------ */

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const tabs = (sample.match(/\t/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  return tabs > 0 && tabs >= commas / 2 ? "\t" : ",";
}

/** CSV/TSV 텍스트를 셀 배열로 나눈다. 따옴표 안의 구분자·줄바꿈을 지원한다. */
export function parseTable(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.map((cells) => cells.map((value) => value.trim()));
}

/* ------------------------------------------------------------------ */
/* 열 인식                                                             */
/* ------------------------------------------------------------------ */

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s_\-./()[\]:·]/g, "");
}

const EXACT_HEADERS: Record<LedgerField, string[]> = {
  title: ["캠페인", "캠페인명", "업체", "업체명", "가게", "매장", "제품", "제품명", "상품", "상품명", "브랜드", "리뷰어", "제목", "campaign", "title", "name"],
  platform: ["플랫폼", "사이트", "채널", "매체", "플랫폼채널", "platform", "channel", "site"],
  deadline: ["마감", "마감일", "포스팅마감", "업로드마감", "리뷰마감", "제출마감", "작성마감", "발행마감", "등록마감", "deadline", "due"],
  publishedUrl: ["url", "링크", "포스팅url", "포스팅링크", "포스팅주소", "리뷰링크", "리뷰url", "발행url", "발행링크", "게시물", "게시물링크", "업로드링크", "link", "postingurl"],
  expectedCash: ["원고료", "지급액", "현금", "페이백", "지급예정액", "약속금액", "금액", "fee", "amount"],
  receivedCash: ["입금액", "받은금액", "실입금", "실입금액", "입금", "지급된금액", "received"],
  paymentDue: ["지급예정일", "지급일", "정산일", "정산예정일", "입금예정일", "입금일정", "paydate", "paymentdue"],
  paid: ["정산", "정산여부", "정산상태", "지급완료", "지급여부", "입금여부", "입금확인", "paid"],
  status: ["상태", "진행상태", "진행", "status"],
  provided: ["제공내역", "제공", "포인트", "혜택", "리워드", "제공품", "reward"],
  note: ["비고", "메모", "note", "memo"],
};

// 부분 일치는 더 구체적인 필드부터 확인한다.
const CONTAINS_ORDER: [LedgerField, string[]][] = [
  ["paymentDue", ["지급예정일", "지급일", "정산일", "입금예정"]],
  ["receivedCash", ["입금액", "실입금", "받은금액"]],
  ["paid", ["정산여부", "지급완료", "입금여부", "정산상태"]],
  ["publishedUrl", ["url", "링크", "주소", "link"]],
  ["deadline", ["마감", "deadline"]],
  ["expectedCash", ["원고료", "페이백", "지급액"]],
  ["provided", ["제공", "포인트", "혜택"]],
  ["platform", ["플랫폼", "채널", "사이트"]],
  ["status", ["상태"]],
  ["note", ["비고", "메모"]],
  ["title", ["캠페인", "업체", "제품", "상품", "리뷰어"]],
];

export type ColumnMap = Partial<Record<LedgerField, number>>;

export function detectColumns(header: string[]): ColumnMap {
  const map: ColumnMap = {};
  const used = new Set<number>();
  const normalized = header.map(normalizeHeader);

  normalized.forEach((value, index) => {
    if (!value) return;
    for (const field of Object.keys(EXACT_HEADERS) as LedgerField[]) {
      if (map[field] !== undefined) continue;
      if (EXACT_HEADERS[field].includes(value)) {
        map[field] = index;
        used.add(index);
        return;
      }
    }
  });

  for (const [field, needles] of CONTAINS_ORDER) {
    if (map[field] !== undefined) continue;
    const index = normalized.findIndex(
      (value, i) => !used.has(i) && value && needles.some((n) => value.includes(n)),
    );
    if (index >= 0) {
      map[field] = index;
      used.add(index);
    }
  }

  return map;
}

/* ------------------------------------------------------------------ */
/* 값 정규화                                                           */
/* ------------------------------------------------------------------ */

const EMPTY_MARKERS = new Set(["", "-", "–", "—", "없음", "n/a", "na", "x"]);

function isEmptyValue(value: string | undefined | null) {
  if (value === undefined || value === null) return true;
  return EMPTY_MARKERS.has(value.trim().toLowerCase());
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function validDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dayNumber(key: string) {
  return Date.parse(`${key}T00:00:00Z`) / 86_400_000;
}

export function daysBetween(fromKey: string, toKey: string) {
  return dayNumber(toKey) - dayNumber(fromKey);
}

/**
 * 한국 시트에서 흔한 날짜 표기를 `YYYY-MM-DD`로 바꾼다.
 * 빈 값은 null, 읽을 수 없는 값은 undefined를 돌려준다.
 */
export function parseSheetDate(raw: string | undefined | null, todayKey: string): string | null | undefined {
  if (isEmptyValue(raw)) return null;
  const text = String(raw)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[월화수목금토일]요일/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const todayYear = Number(todayKey.slice(0, 4));

  let year: number | null = null;
  let month: number;
  let day: number;

  let match = /^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?(?:\s.*)?$/.exec(text);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else if ((match = /^(\d{2})\s*[.]\s*(\d{1,2})\s*[.]\s*(\d{1,2})\.?$/.exec(text))) {
    year = 2000 + Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else if ((match = /^(\d{1,2})\s*[-./]\s*(\d{1,2})\.?(?:\s.*)?$/.exec(text))) {
    month = Number(match[1]);
    day = Number(match[2]);
  } else if ((match = /^(\d{1,2})\s*월\s*(\d{1,2})\s*일?(?:\s.*)?$/.exec(text))) {
    month = Number(match[1]);
    day = Number(match[2]);
  } else {
    return undefined;
  }

  if (year === null) {
    // 연도가 없으면 오늘과 가장 가까운 해로 추정한다 (연말·연초 경계 보정).
    let candidate = todayYear;
    if (!validDate(candidate, month, day)) return undefined;
    const key = `${candidate}-${pad(month)}-${pad(day)}`;
    const diff = daysBetween(todayKey, key);
    if (diff > 183) candidate -= 1;
    else if (diff < -183) candidate += 1;
    year = candidate;
  }

  if (!validDate(year, month, day)) return undefined;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * `50,000`, `5만`, `3.5만원`, `1만5천`, `₩30000` 같은 금액을 원 단위 정수로 바꾼다.
 * 빈 값은 null, 읽을 수 없는 값은 undefined를 돌려준다.
 */
export function parseAmount(raw: string | undefined | null): number | null | undefined {
  if (isEmptyValue(raw)) return null;
  const text = String(raw)
    .replace(/[,\s₩]/g, "")
    .replace(/^약/, "")
    .replace(/원(상당)?$/, "")
    .replace(/상당$/, "");

  if (/^\d+$/.test(text)) return Number(text);

  const unit = /^(?:(\d+(?:\.\d+)?)만)?(?:(\d+(?:\.\d+)?)천)?$/.exec(text);
  if (unit && (unit[1] || unit[2])) {
    const value =
      Number(unit[1] || 0) * 10_000 + Number(unit[2] || 0) * 1_000;
    return Math.round(value);
  }

  return undefined;
}

const PAID_WORDS = new Set(["o", "○", "◯", "y", "yes", "true", "완료", "입금완료", "지급완료", "정산완료", "✅", "✔", "✓", "v", "입금", "지급", "받음"]);
const UNPAID_WORDS = new Set(["x", "✕", "×", "✗", "n", "no", "false", "미입금", "미지급", "미정산", "대기", "예정", "입금대기", "지급대기", "안받음"]);
const PARTIAL_WORDS = ["부분", "일부"];

export function parsePaidFlag(raw: string | undefined | null): PaidState {
  if (raw === undefined || raw === null) return null;
  const text = raw.trim().toLowerCase().replace(/\s/g, "");
  if (!text || text === "-") return null;
  if (PARTIAL_WORDS.some((word) => text.includes(word))) return "partial";
  if (PAID_WORDS.has(text)) return "paid";
  if (UNPAID_WORDS.has(text)) return "unpaid";
  return null;
}

const CANCELLED_PATTERN = /(취소|미선정|탈락|불발|드랍|드롭|cancel|drop)/i;

/** 발행 URL 칸을 URL / URL이 아닌 메모 / 비어 있음으로 나눈다. */
export function classifyPublished(raw: string | undefined | null): {
  state: PublishState;
  url: string | null;
} {
  if (isEmptyValue(raw)) return { state: "none", url: null };
  const text = String(raw).trim();
  const candidate = /^https?:\/\//i.test(text)
    ? text
    : /^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)+\/)/i.test(text)
      ? `https://${text}`
      : null;

  if (candidate && !/\s/.test(candidate)) {
    try {
      const url = new URL(candidate);
      if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".")) {
        return { state: "url", url: url.toString() };
      }
    } catch {
      // URL이 아니면 메모로 본다.
    }
  }

  return { state: "memo", url: null };
}

/* ------------------------------------------------------------------ */
/* 진단                                                                */
/* ------------------------------------------------------------------ */

function cellAt(cells: string[], index: number | undefined) {
  if (index === undefined) return undefined;
  return cells[index];
}

function findHeaderRow(rows: string[][]) {
  const limit = Math.min(rows.length, 10);
  for (let i = 0; i < limit; i += 1) {
    const map = detectColumns(rows[i]);
    const recognized = Object.keys(map).length;
    if (recognized >= 2 && map.title !== undefined) return { index: i, map };
  }
  for (let i = 0; i < limit; i += 1) {
    const map = detectColumns(rows[i]);
    if (Object.keys(map).length >= 2) {
      // 캠페인 열을 못 찾았으면 첫 번째 미인식 열을 캠페인으로 본다.
      const used = new Set(Object.values(map));
      const fallback = rows[i].findIndex((value, index) => value && !used.has(index));
      if (fallback >= 0) map.title = fallback;
      return { index: i, map };
    }
  }
  return null;
}

function duplicateKey(title: string, platform: string | null) {
  return `${title.toLowerCase().replace(/\s/g, "")}|${(platform || "").toLowerCase().replace(/\s/g, "")}`;
}

export function diagnoseLedger(text: string, todayKey: string): LedgerDiagnosis {
  if (!text || !text.trim()) {
    return { ok: false, error: "붙여넣은 내용이 없어요. 시트에서 열 이름이 있는 첫 줄부터 복사해 주세요." };
  }
  if (text.length > LEDGER_MAX_CHARS) {
    return { ok: false, error: "내용이 너무 길어요. 한 번에 500행 이하로 나눠서 넣어 주세요." };
  }

  const table = parseTable(text).filter((cells) => cells.some((cell) => cell !== ""));
  const header = findHeaderRow(table);
  if (!header) {
    return {
      ok: false,
      error: "열 이름을 찾지 못했어요. 첫 줄에 캠페인·마감·URL·원고료 같은 열 이름이 있어야 해요.",
    };
  }

  const { index: headerIndex, map } = header;
  const headerCells = table[headerIndex];
  const columns = (Object.entries(map) as [LedgerField, number][])
    .sort((a, b) => a[1] - b[1])
    .map(([field, index]) => ({ field, header: headerCells[index] }));
  const core: LedgerField[] = ["title", "deadline", "publishedUrl", "expectedCash", "paymentDue"];
  const missingFields = core.filter((field) => map[field] === undefined);

  const body = table.slice(headerIndex + 1);
  const truncated = body.length > LEDGER_MAX_ROWS;
  const rows: LedgerRow[] = [];
  const seen = new Map<string, number>();

  body.slice(0, LEDGER_MAX_ROWS).forEach((cells, offset) => {
    const title = (cellAt(cells, map.title) || "").trim();
    if (!title) return;

    const platformRaw = cellAt(cells, map.platform);
    const platform = isEmptyValue(platformRaw) ? null : platformRaw!.trim();
    const statusRaw = cellAt(cells, map.status) || "";
    const noteRaw = cellAt(cells, map.note) || "";
    const paidRaw = cellAt(cells, map.paid) || "";
    const cancelled =
      CANCELLED_PATTERN.test(statusRaw) ||
      CANCELLED_PATTERN.test(noteRaw) ||
      CANCELLED_PATTERN.test(paidRaw);

    const deadlineRaw = cellAt(cells, map.deadline) ?? null;
    const deadline = parseSheetDate(deadlineRaw, todayKey);
    const paymentDueRaw = cellAt(cells, map.paymentDue) ?? null;
    const paymentDue = parseSheetDate(paymentDueRaw, todayKey);
    const expectedRaw = cellAt(cells, map.expectedCash);
    const expectedCash = parseAmount(expectedRaw);
    const receivedRaw = cellAt(cells, map.receivedCash);
    const receivedCash = parseAmount(receivedRaw);
    const publishedRaw = cellAt(cells, map.publishedUrl) ?? null;
    const published = classifyPublished(publishedRaw);
    let paidState = parsePaidFlag(paidRaw);
    if (
      paidState === null &&
      typeof expectedCash === "number" &&
      expectedCash > 0 &&
      typeof receivedCash === "number"
    ) {
      paidState = receivedCash >= expectedCash ? "paid" : receivedCash > 0 ? "partial" : "unpaid";
    }

    const findings: LedgerFinding[] = [];
    const row: LedgerRow = {
      sheetRow: headerIndex + offset + 2,
      title,
      platform,
      deadline: deadline ?? null,
      deadlineRaw: isEmptyValue(deadlineRaw) ? null : deadlineRaw,
      publishedUrl: published.url,
      publishedRaw: isEmptyValue(publishedRaw) ? null : publishedRaw,
      publishState: published.state,
      expectedCash: expectedCash ?? null,
      receivedCash: receivedCash ?? null,
      paymentDue: paymentDue ?? null,
      paymentDueRaw: isEmptyValue(paymentDueRaw) ? null : paymentDueRaw,
      paidState,
      provided: isEmptyValue(cellAt(cells, map.provided)) ? null : cellAt(cells, map.provided)!.trim(),
      note: noteRaw.trim() || null,
      cancelled,
      findings,
    };

    const key = duplicateKey(title, platform);
    const firstRow = seen.get(key);
    if (firstRow !== undefined) {
      findings.push({
        kind: "duplicate",
        severity: "warning",
        detail: `${firstRow}행과 같은 캠페인이 다시 적혀 있어요.`,
      });
    } else {
      seen.set(key, row.sheetRow);
    }

    if (cancelled) {
      rows.push(row);
      return;
    }

    const unreadable: string[] = [];
    if (deadline === undefined) unreadable.push(`마감 "${deadlineRaw}"`);
    if (paymentDue === undefined) unreadable.push(`지급 예정일 "${paymentDueRaw}"`);
    if (expectedCash === undefined) unreadable.push(`약속 금액 "${expectedRaw}"`);
    if (receivedCash === undefined) unreadable.push(`입금액 "${receivedRaw}"`);
    if (unreadable.length) {
      findings.push({
        kind: "unreadable_value",
        severity: "info",
        detail: `읽지 못한 값: ${unreadable.join(", ")}`,
      });
    }

    if (published.state === "memo") {
      findings.push({
        kind: "invalid_url",
        severity: "warning",
        detail: `URL 대신 "${publishedRaw}"가 적혀 있어 발행 여부를 확인할 수 없어요.`,
      });
    }

    if (deadline && published.state === "none") {
      const days = daysBetween(todayKey, deadline);
      if (days < 0) {
        findings.push({
          kind: "overdue_unpublished",
          severity: "critical",
          detail: `마감 ${Math.abs(days)}일 지남, 발행 URL 없음`,
        });
      } else if (days <= DUE_SOON_DAYS) {
        findings.push({
          kind: "due_soon_unpublished",
          severity: "warning",
          detail: days === 0 ? "오늘 마감, 발행 URL 없음" : `마감 ${days}일 남음, 발행 URL 없음`,
        });
      }
    }

    if (typeof expectedCash === "number" && expectedCash > 0 && paidState !== "paid") {
      const received = typeof receivedCash === "number" ? receivedCash : 0;
      const outstanding = Math.max(expectedCash - received, 0);
      if (outstanding > 0) {
        const dueDays = paymentDue ? daysBetween(todayKey, paymentDue) : null;
        if (dueDays !== null && dueDays < 0) {
          findings.push({
            kind: "payment_overdue",
            severity: "critical",
            detail:
              received > 0
                ? `지급 예정일 ${Math.abs(dueDays)}일 지남, ${received.toLocaleString("ko-KR")}원만 입금`
                : `지급 예정일 ${Math.abs(dueDays)}일 지남, 미입금`,
            amount: outstanding,
          });
        } else if (received > 0 || paidState === "partial") {
          findings.push({
            kind: "payment_partial",
            severity: "warning",
            detail: `약속 ${expectedCash.toLocaleString("ko-KR")}원 중 ${received.toLocaleString("ko-KR")}원 입금`,
            amount: outstanding,
          });
        } else if (paymentDue === null && published.state !== "none") {
          findings.push({
            kind: "payment_unscheduled",
            severity: "warning",
            detail: "발행했지만 지급 예정일이 비어 있어요.",
            amount: outstanding,
          });
        }
      }
    }

    rows.push(row);
  });

  const active = rows.filter((row) => !row.cancelled);
  const count = (kind: FindingKind) =>
    active.filter((row) => row.findings.some((f) => f.kind === kind)).length;

  let overdueOutstanding = 0;
  let pendingOutstanding = 0;
  for (const row of active) {
    if (row.paidState === "paid") continue;
    if (typeof row.expectedCash !== "number" || row.expectedCash <= 0) continue;
    const outstanding = Math.max(row.expectedCash - (row.receivedCash ?? 0), 0);
    pendingOutstanding += outstanding;
    if (row.findings.some((f) => f.kind === "payment_overdue")) {
      overdueOutstanding += outstanding;
    }
  }

  return {
    ok: true,
    todayKey,
    columns,
    missingFields,
    rows,
    truncated,
    summary: {
      totalRows: rows.length,
      activeRows: active.length,
      cancelledRows: rows.length - active.length,
      overdueUnpublished: count("overdue_unpublished"),
      dueSoonUnpublished: count("due_soon_unpublished"),
      paymentOverdue: count("payment_overdue"),
      overdueOutstanding,
      pendingOutstanding,
      needsReview: active.filter((row) =>
        row.findings.some((f) => f.kind === "unreadable_value" || f.kind === "invalid_url"),
      ).length,
      duplicates: rows.filter((row) => row.findings.some((f) => f.kind === "duplicate")).length,
    },
  };
}

/** 서울 기준 오늘 날짜 키 */
export function seoulTodayKey(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
