"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <main className="state-page">
          <section className="state-page-card">
            <h1>서비스를 불러오지 못했습니다.</h1>
            <p>일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.</p>
            <div className="state-page-actions">
              <button type="button" onClick={reset}>다시 시도</button>
              <Link href="/">홈으로 이동</Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
