import type { Metadata } from "next";

import { WebHeader } from "../web-header";
import { LedgerCheckClient } from "./ledger-check-client";

export const metadata: Metadata = {
  title: "체험단 누락 무료 진단",
  description:
    "체험단 관리 시트를 붙여넣으면 마감이 지난 미발행 캠페인과 지급일이 지난 원고료·페이백을 로그인 없이 바로 찾아드려요.",
  alternates: {
    canonical: "/check",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LedgerCheckPage() {
  return (
    <main className="site-shell ledger-check-page">
      <WebHeader active="check" />

      <section className="ledger-check-page-head">
        <div>
          <h1>체험단 시트, 놓친 게 있는지 30초 만에 확인하세요</h1>
          <p>
            마감이 지났는데 발행하지 않은 캠페인과 지급일이 지났는데 받지 못한 원고료·페이백을 찾아드려요.
            가입하지 않아도 돼요.
          </p>
        </div>
        <div className="ledger-check-page-meta">
          <span>로그인 없음</span>
          <span>·</span>
          <span>서버 저장 없음</span>
        </div>
      </section>

      <LedgerCheckClient />
    </main>
  );
}
