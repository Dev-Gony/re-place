import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "../../lib/auth/server";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in?callbackURL=/my");
  }

  return (
    <main className="my-page">
      <header className="my-page-header">
        <Link href="/" className="brand" aria-label="Re:Place 홈">
          <span className="brand-mark">R</span>
          <span className="brand-text">Re:Place</span>
        </Link>
        <Link href="/">캠페인 찾기</Link>
      </header>

      <section className="my-page-hero">
        <span>MY RE:PLACE</span>
        <h1>{session.user.name || session.user.email}님의 체험단 관리</h1>
        <p>
          로그인 경계가 연결됐습니다. 찜, 수동 등록, 지원 기록은 다음 기능에서
          이 사용자 계정에만 귀속됩니다.
        </p>
      </section>

      <section className="my-page-grid">
        <article>
          <span>찜한 캠페인</span>
          <strong>0</strong>
          <small>RPL-013에서 연결</small>
        </article>
        <article>
          <span>내 체험단</span>
          <strong>0</strong>
          <small>수동 등록·지원 기록 예정</small>
        </article>
        <article>
          <span>다가오는 마감</span>
          <strong>0</strong>
          <small>개인 마감 관리 예정</small>
        </article>
      </section>
    </main>
  );
}
