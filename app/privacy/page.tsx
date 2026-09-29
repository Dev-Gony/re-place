import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "Re:Place 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link href="/" className="legal-back">← Re:Place</Link>
        <h1>개인정보처리방침</h1>
        <p className="legal-updated">시행일: 2026년 9월 29일</p>

        <section>
          <h2>1. 처리하는 정보</h2>
          <p>
            Re:Place는 로그인과 개인 기능 제공을 위해 이메일, 계정 식별자,
            로그인 세션 정보를 처리할 수 있습니다. 사용자가 직접 등록한 찜,
            체험단 진행 상태, 메모와 마감 정보도 계정에 연결해 저장합니다.
          </p>
        </section>

        <section>
          <h2>2. 이용 목적</h2>
          <p>
            계정 인증, 개인별 찜과 체험단 기록 제공, 서비스 안정성 확인,
            오류 분석과 서비스 개선을 위해 필요한 범위에서 정보를 사용합니다.
          </p>
        </section>

        <section>
          <h2>3. 보관과 삭제</h2>
          <p>
            개인 기능 데이터는 서비스 제공 기간 동안 보관하며, 계정 삭제 기능이
            제공되기 전에는 운영 문의를 통해 삭제 요청을 접수할 수 있습니다.
            법령상 보관 의무가 있는 경우에는 해당 기간 동안 별도로 보관할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>4. 외부 서비스</h2>
          <p>
            인증과 데이터 저장에는 Neon 기반 서비스를 사용하고, 웹 서비스
            제공과 성능 측정에는 Vercel을 사용합니다. 각 외부 서비스는
            서비스 운영에 필요한 범위에서만 사용합니다.
          </p>
        </section>

        <section>
          <h2>5. 분석 정보</h2>
          <p>
            페이지 이용 현황과 성능을 확인하기 위해 Vercel Analytics와
            Speed Insights를 사용할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>6. 문의</h2>
          <p>
            개인정보 관련 요청은 서비스 운영 채널을 통해 접수합니다.
            정식 공개 운영 전 연락처와 사업자 정보가 확정되면 본 문서를 갱신합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
