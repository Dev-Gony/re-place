import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "../../lib/auth/server";
import { MyWorkspace } from "./my-workspace";

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
          찜한 캠페인을 모으고, 지원·선정·방문·리뷰 완료까지 직접 관리하세요.
        </p>
      </section>

      <MyWorkspace />
    </main>
  );
}
