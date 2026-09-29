import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관",
  description: "Re:Place 이용약관",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link href="/" className="legal-back">← Re:Place</Link>
        <h1>이용약관</h1>
        <p className="legal-updated">시행일: 2026년 9월 29일</p>

        <section>
          <h2>1. 서비스 목적</h2>
          <p>
            Re:Place는 여러 체험단 플랫폼의 공개 캠페인 정보를 정리해
            검색과 비교를 돕는 서비스입니다.
          </p>
        </section>

        <section>
          <h2>2. 원본 정보</h2>
          <p>
            캠페인의 모집 여부, 혜택, 일정, 조건은 원본 플랫폼에서 변경될 수
            있습니다. 최종 신청과 참여 판단 전 반드시 원본 페이지의 최신 정보를
            확인해야 합니다.
          </p>
        </section>

        <section>
          <h2>3. 계정 기능</h2>
          <p>
            로그인 사용자는 찜, 수동 등록, 참여 상태와 메모 등 개인 관리 기능을
            사용할 수 있습니다. 사용자는 자신의 계정 정보와 기록을 적절히 관리해야 합니다.
          </p>
        </section>

        <section>
          <h2>4. 서비스 변경과 중단</h2>
          <p>
            외부 플랫폼의 구조 변경, 정책 변경, 장애 등으로 특정 캠페인 또는
            플랫폼 정보 제공이 일시 중단될 수 있습니다.
          </p>
        </section>

        <section>
          <h2>5. 금지 사항</h2>
          <p>
            서비스의 정상 운영을 방해하거나, 비정상적인 자동 요청으로 과도한
            부하를 발생시키거나, 타인의 계정 또는 개인 기록에 접근하려는 행위를 금지합니다.
          </p>
        </section>

        <section>
          <h2>6. 약관 변경</h2>
          <p>
            서비스 기능과 운영 방식이 변경되면 필요한 범위에서 약관을 갱신하고
            시행일을 함께 표시합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
