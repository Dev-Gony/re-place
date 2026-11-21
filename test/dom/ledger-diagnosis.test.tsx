import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  classifyPublished,
  detectColumns,
  diagnoseLedger,
  parseAmount,
  parsePaidFlag,
  parseSheetDate,
  parseTable,
  seoulTodayKey,
} from "../../lib/ledger-diagnosis";
import { PERSONA_SAMPLES } from "../../lib/ledger-samples";

const TODAY = "2026-11-21";

describe("RPL-063 ledger parsing", () => {
  test("parses TSV and quoted CSV cells", () => {
    assert.deepEqual(parseTable("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
    assert.deepEqual(parseTable('a,b\n"x, y","say ""hi"""'), [
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
    assert.deepEqual(parseTable("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
  });

  test("normalizes Korean sheet dates and infers the nearest year", () => {
    assert.equal(parseSheetDate("2026-11-03", TODAY), "2026-11-03");
    assert.equal(parseSheetDate("2026.11.3", TODAY), "2026-11-03");
    assert.equal(parseSheetDate("2026/11/03 (화)", TODAY), "2026-11-03");
    assert.equal(parseSheetDate("26.11.03", TODAY), "2026-11-03");
    assert.equal(parseSheetDate("11/3", TODAY), "2026-11-03");
    assert.equal(parseSheetDate("11월 3일", TODAY), "2026-11-03");
    assert.equal(parseSheetDate("2026년 11월 3일", TODAY), "2026-11-03");
    assert.equal(parseSheetDate("1/5", "2026-12-28"), "2027-01-05");
    assert.equal(parseSheetDate("12/28", "2027-01-03"), "2026-12-28");
    assert.equal(parseSheetDate("", TODAY), null);
    assert.equal(parseSheetDate("-", TODAY), null);
    assert.equal(parseSheetDate("익월 10일", TODAY), undefined);
    assert.equal(parseSheetDate("2/30", TODAY), undefined);
  });

  test("normalizes Korean amount notation", () => {
    assert.equal(parseAmount("50,000"), 50_000);
    assert.equal(parseAmount("50000원"), 50_000);
    assert.equal(parseAmount("5만"), 50_000);
    assert.equal(parseAmount("3.5만원"), 35_000);
    assert.equal(parseAmount("1만5천"), 15_000);
    assert.equal(parseAmount("₩ 30,000"), 30_000);
    assert.equal(parseAmount("-"), null);
    assert.equal(parseAmount(""), null);
    assert.equal(parseAmount("협의"), undefined);
  });

  test("reads paid flags", () => {
    assert.equal(parsePaidFlag("O"), "paid");
    assert.equal(parsePaidFlag("입금완료"), "paid");
    assert.equal(parsePaidFlag("X"), "unpaid");
    assert.equal(parsePaidFlag("대기"), "unpaid");
    assert.equal(parsePaidFlag("부분입금"), "partial");
    assert.equal(parsePaidFlag(""), null);
  });

  test("classifies published URLs and memos", () => {
    assert.equal(classifyPublished("https://blog.naver.com/a/1").state, "url");
    assert.equal(classifyPublished("blog.naver.com/a/1").url, "https://blog.naver.com/a/1");
    assert.equal(classifyPublished("블로그 올림").state, "memo");
    assert.equal(classifyPublished("javascript:alert(1)").state, "memo");
    assert.equal(classifyPublished("").state, "none");
  });

  test("detects persona headers without confusing payment columns", () => {
    const map = detectColumns(["캠페인", "채널", "업로드 마감", "링크", "원고료", "지급예정일", "입금액", "정산"]);
    assert.deepEqual(map, {
      title: 0,
      platform: 1,
      deadline: 2,
      publishedUrl: 3,
      expectedCash: 4,
      paymentDue: 5,
      receivedCash: 6,
      paid: 7,
    });
  });

  test("returns a readable error without a header row", () => {
    const result = diagnoseLedger("1\t2\t3", TODAY);
    assert.equal(result.ok, false);
    assert.equal(diagnoseLedger("   ", TODAY).ok, false);
  });

  test("seoul today key uses Asia/Seoul", () => {
    assert.equal(seoulTodayKey(new Date("2026-11-21T16:00:00Z")), "2026-11-22");
  });
});

describe("RPL-063 persona samples", () => {
  for (const persona of PERSONA_SAMPLES) {
    for (const today of [TODAY, "2026-12-30", "2027-01-02"]) {
      test(`${persona.id} on ${today} matches expected findings`, () => {
        const result = diagnoseLedger(persona.build(today), today);
        assert.equal(result.ok, true);
        if (!result.ok) return;
        const { summary } = result;
        assert.deepEqual(
          {
            overdueUnpublished: summary.overdueUnpublished,
            dueSoonUnpublished: summary.dueSoonUnpublished,
            paymentOverdue: summary.paymentOverdue,
            overdueOutstanding: summary.overdueOutstanding,
            pendingOutstanding: summary.pendingOutstanding,
            cancelledRows: summary.cancelledRows,
            needsReview: summary.needsReview,
            duplicates: summary.duplicates,
          },
          persona.expected,
        );
        assert.deepEqual(result.missingFields.filter((f) => f === "title" || f === "deadline"), []);
      });
    }
  }

  test("cancelled rows never produce findings other than duplicate", () => {
    for (const persona of PERSONA_SAMPLES) {
      const result = diagnoseLedger(persona.build(TODAY), TODAY);
      if (!result.ok) continue;
      for (const row of result.rows.filter((r) => r.cancelled)) {
        assert.deepEqual(row.findings.filter((f) => f.kind !== "duplicate"), []);
      }
    }
  });

  test("paid rows are never counted as outstanding", () => {
    const persona = PERSONA_SAMPLES.find((p) => p.id === "multi-channel")!;
    const result = diagnoseLedger(persona.build(TODAY), TODAY);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const earphones = result.rows.find((row) => row.title === "무선 이어폰")!;
    assert.equal(earphones.paidState, "paid");
    assert.deepEqual(earphones.findings, []);
  });
});
