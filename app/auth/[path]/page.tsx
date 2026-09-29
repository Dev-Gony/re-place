import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths } from "@neondatabase/auth-ui/server";
import Link from "next/link";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <main className="auth-page">
      <Link href="/" className="auth-back-link">
        ← 캠페인 검색으로 돌아가기
      </Link>
      <section className="auth-card-shell">
        <AuthView path={path} />
      </section>
    </main>
  );
}
