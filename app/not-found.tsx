import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-page">
      <section className="state-page-card">
        <span>404</span>
        <h1>페이지를 찾을 수 없습니다.</h1>
        <p>주소가 바뀌었거나 존재하지 않는 페이지입니다.</p>
        <Link href="/">캠페인 찾기로 돌아가기</Link>
      </section>
    </main>
  );
}
