"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type ChangeEvent } from "react";

import {
  FIELD_LABELS,
  diagnoseLedger,
  seoulTodayKey,
  type FindingKind,
  type LedgerRow,
} from "../../lib/ledger-diagnosis";
import {
  PERSONA_SAMPLES,
  type Perspective,
  type PersonaId,
} from "../../lib/ledger-samples";
import { stashLedgerImport } from "../../lib/ledger-import";

const MAX_FILE_BYTES = 512 * 1024;

const FINDING_LABELS: Record<FindingKind, string> = {
  overdue_unpublished: "마감 지남 · 미발행",
  due_soon_unpublished: "마감 임박 · 미발행",
  payment_overdue: "지급일 지남",
  payment_partial: "부분 입금",
  payment_unscheduled: "지급일 미정",
  invalid_url: "URL 확인 필요",
  duplicate: "중복 행",
  unreadable_value: "읽지 못한 값",
};

function won(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function severityRank(row: LedgerRow) {
  if (row.findings.some((f) => f.severity === "critical")) return 0;
  if (row.findings.some((f) => f.severity === "warning")) return 1;
  if (row.findings.length) return 2;
  return 3;
}

export function LedgerCheckClient() {
  const inputId = useId();
  const fileId = useId();
  const [text, setText] = useState("");
  const [persona, setPersona] = useState<PersonaId | null>(null);
  const [perspective, setPerspective] = useState<Perspective>("creator");
  const [fileError, setFileError] = useState<string | null>(null);
  const [todayKey] = useState(() => seoulTodayKey());
  const [stashed, setStashed] = useState(false);
  const resultRef = useRef<HTMLElement>(null);

  const result = useMemo(
    () => (text.trim() ? diagnoseLedger(text, todayKey) : null),
    [text, todayKey],
  );

  const words =
    perspective === "payer"
      ? { money: "줘야 할 돈", unpaid: "아직 지급하지 않은", publish: "리뷰를 올리지 않은 리뷰어" }
      : { money: "받을 돈", unpaid: "아직 받지 못한", publish: "발행하지 않은 캠페인" };

  function loadPersona(id: PersonaId) {
    const sample = PERSONA_SAMPLES.find((item) => item.id === id);
    if (!sample) return;
    setPersona(id);
    setPerspective(sample.perspective);
    setText(sample.build(todayKey));
    setFileError(null);
    setStashed(false);
    // 좁은 화면에서는 결과가 입력창 아래에 있으므로 바로 보여준다.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
      window.requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError("파일이 너무 커요. 512KB 이하 CSV만 읽을 수 있어요.");
      return;
    }
    if (/\.xlsx?$/i.test(file.name)) {
      setFileError("엑셀 파일은 아직 직접 읽지 못해요. 시트에서 범위를 복사해 붙여넣거나 CSV로 저장해 주세요.");
      return;
    }
    file
      .text()
      .then((content) => {
        setPersona(null);
        setFileError(null);
        setStashed(false);
        setText(content.replace(/^﻿/, ""));
      })
      .catch(() => setFileError("파일을 읽지 못했어요."));
  }

  function saveForImport() {
    if (!result?.ok) return;
    setStashed(stashLedgerImport(result.rows, todayKey));
  }

  const sortedRows = result?.ok
    ? [...result.rows].sort((a, b) => severityRank(a) - severityRank(b) || a.sheetRow - b.sheetRow)
    : [];
  const flaggedRows = sortedRows.filter((row) => !row.cancelled && row.findings.length > 0);
  const cleanRows = sortedRows.filter((row) => !row.cancelled && row.findings.length === 0);
  const cancelledRows = sortedRows.filter((row) => row.cancelled);

  return (
    <div className="ledger-check">
      <section className="ledger-check-input" aria-labelledby={`${inputId}-title`}>
        <div className="ledger-check-input-head">
          <h2 id={`${inputId}-title`}>1. 시트를 붙여넣으세요</h2>
          <p>구글 시트·엑셀에서 열 이름이 있는 첫 줄부터 복사해서 붙여넣거나 CSV 파일을 올리면 바로 진단해요.</p>
        </div>

        <div className="ledger-check-personas" role="group" aria-label="예시 시트">
          <span>예시로 해보기</span>
          {PERSONA_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              data-persona={sample.id}
              aria-pressed={persona === sample.id}
              onClick={() => loadPersona(sample.id)}
              title={sample.summary}
            >
              {sample.label}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor={inputId}>시트 내용</label>
        <textarea
          id={inputId}
          className="ledger-check-textarea"
          value={text}
          spellCheck={false}
          placeholder={"캠페인\t플랫폼\t마감\t포스팅 URL\t원고료\t지급예정일\t입금액\n성수 파스타집\t리뷰노트\t11/18\t\t50,000\t11/30\t"}
          onChange={(event) => {
            setText(event.target.value);
            setPersona(null);
            setStashed(false);
          }}
        />

        <div className="ledger-check-input-actions">
          <label htmlFor={fileId} className="ledger-check-file">CSV 파일 올리기</label>
          <input id={fileId} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={onFile} hidden />
          {text && (
            <button
              type="button"
              className="ledger-check-clear"
              onClick={() => {
                setText("");
                setPersona(null);
                setStashed(false);
              }}
            >
              지우기
            </button>
          )}
          <div className="ledger-check-perspective" role="group" aria-label="시트 관점">
            <button type="button" aria-pressed={perspective === "creator"} onClick={() => setPerspective("creator")}>
              받는 쪽 (크리에이터)
            </button>
            <button type="button" aria-pressed={perspective === "payer"} onClick={() => setPerspective("payer")}>
              주는 쪽 (셀러·모집자)
            </button>
          </div>
        </div>
        {fileError && <p className="ledger-check-error" role="alert">{fileError}</p>}
        <p className="ledger-check-privacy">붙여넣은 내용은 이 브라우저 안에서만 계산하고 서버로 보내지 않아요.</p>
      </section>

      <section ref={resultRef} className="ledger-check-result" aria-live="polite" aria-labelledby={`${inputId}-result`}>
        <h2 id={`${inputId}-result`}>2. 진단 결과</h2>

        {!result && (
          <p className="ledger-check-empty">시트를 붙여넣거나 예시 시트를 고르면 여기에서 놓친 발행과 {words.money}을 보여드려요.</p>
        )}

        {result && !result.ok && (
          <p className="ledger-check-error" role="alert">{result.error}</p>
        )}

        {result?.ok && (
          <>
            <p className="ledger-check-headline" data-testid="ledger-headline">
              {result.summary.overdueUnpublished === 0 && result.summary.paymentOverdue === 0 ? (
                <>지금 기준으로 마감이 지난 미발행 건과 지급일이 지난 {words.money}은 없어요.</>
              ) : (
                <>
                  마감이 지났는데 {words.publish} <strong>{result.summary.overdueUnpublished}건</strong>
                  {result.summary.paymentOverdue > 0 && (
                    <>
                      , 지급일이 지났는데 {words.unpaid} 돈 <strong>{won(result.summary.overdueOutstanding)}</strong>
                    </>
                  )}
                  이 있어요.
                </>
              )}
            </p>

            <dl className="ledger-check-metrics">
              <div data-tone="critical">
                <dt>마감 지남 · 미발행</dt>
                <dd data-testid="metric-overdue-unpublished">{result.summary.overdueUnpublished}건</dd>
              </div>
              <div data-tone="warning">
                <dt>{3}일 안에 마감 · 미발행</dt>
                <dd data-testid="metric-due-soon">{result.summary.dueSoonUnpublished}건</dd>
              </div>
              <div data-tone="critical">
                <dt>지급일 지난 {words.money}</dt>
                <dd data-testid="metric-overdue-outstanding">{won(result.summary.overdueOutstanding)}</dd>
              </div>
              <div>
                <dt>전체 {words.money} (미입금 합계)</dt>
                <dd data-testid="metric-pending-outstanding">{won(result.summary.pendingOutstanding)}</dd>
              </div>
            </dl>

            <div className="ledger-check-columns">
              <span>인식한 열</span>
              {result.columns.map((column) => (
                <span key={column.field} className="ledger-check-chip">
                  {FIELD_LABELS[column.field]} ← {column.header}
                </span>
              ))}
              {result.missingFields.length > 0 && (
                <p>
                  없는 열: {result.missingFields.map((field) => FIELD_LABELS[field]).join(", ")}.
                  이 열이 있으면 더 많이 찾아낼 수 있어요.
                </p>
              )}
              {result.truncated && <p>앞의 500행만 진단했어요.</p>}
            </div>

            {flaggedRows.length > 0 && (
              <ol className="ledger-check-rows" aria-label="확인이 필요한 행">
                {flaggedRows.map((row) => (
                  <li key={row.sheetRow} data-rank={severityRank(row)}>
                    <div className="ledger-check-row-head">
                      <strong>{row.title}</strong>
                      <span>
                        {row.platform ? `${row.platform} · ` : ""}
                        {row.sheetRow}행
                      </span>
                    </div>
                    <ul>
                      {row.findings.map((finding, index) => (
                        <li key={index} data-severity={finding.severity} data-kind={finding.kind}>
                          <em>{FINDING_LABELS[finding.kind]}</em>
                          <span>{finding.detail}</span>
                          {typeof finding.amount === "number" && <b>{won(finding.amount)}</b>}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}

            <p className="ledger-check-footnote">
              문제 없음 {cleanRows.length}건
              {cancelledRows.length > 0 && ` · 취소·미선정으로 제외 ${cancelledRows.length}건`}
              {result.summary.duplicates > 0 &&
                ` · 중복 의심 ${result.summary.duplicates}건 (합계와 가져오기에서 제외)`}
            </p>

            <div className="ledger-check-cta">
              <div>
                <strong>이 목록을 계속 추적하려면</strong>
                <p>내 체험단에 가져오면 마감과 지급 예정일이 지나는 순간 대시보드에서 다시 알려드려요.</p>
              </div>
              {stashed ? (
                <Link href="/my?import=ledger#ledger-import" className="ledger-check-cta-button" data-testid="ledger-import-link">
                  내 체험단에서 가져오기 계속
                </Link>
              ) : (
                <button type="button" className="ledger-check-cta-button" onClick={saveForImport}>
                  내 체험단으로 가져오기
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
