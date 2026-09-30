import Link from "next/link";

export const metadata = {
  title: "오프라인",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-card">
        <span>OFFLINE</span>
        <h1>인터넷 연결을 확인해 주세요.</h1>
        <p>
          캠페인 검색은 연결이 복구되면 다시 사용할 수 있습니다.
          개인 일정과 정산 정보는 기기에 오프라인 저장하지 않습니다.
        </p>
        <Link href="/">다시 시도</Link>
      </section>
    </main>
  );
}
