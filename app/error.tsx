"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Re:Place] page render failed", {
      digest: error.digest ?? "unknown",
    });
  }, [error]);

  return (
    <main className="state-page">
      <section className="state-page-card">
        <span>ERROR</span>
        <h1>페이지를 불러오지 못했습니다.</h1>
        <p>잠시 후 다시 시도하거나 홈으로 돌아가세요.</p>
        <div className="state-page-actions">
          <button type="button" onClick={reset}>
            다시 시도
          </button>
          <a href="/">홈으로 이동</a>
        </div>
      </section>
    </main>
  );
}
