import type { Metadata } from "next";
import Link from "next/link";
import { WebHeader } from "../web-header";
import { BlogAnalysisClient } from "./blog-analysis-client";

export const metadata: Metadata = {
  title: "블로그 분석",
  description:
    "네이버 블로그 공개 RSS를 바탕으로 활동성·주제 일관성과 분석 커버리지를 확인하세요.",
  alternates: {
    canonical: "/blog-analysis",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function BlogAnalysisPage() {
  return (
    <main className="site-shell blog-analysis-page">
      <WebHeader active="analysis" />

      <section className="blog-analysis-hero">
        <div className="blog-analysis-hero-inner">
          <span className="blog-analysis-kicker">V3 · BLOG ANALYSIS</span>
          <h1>내 블로그를 근거와 함께 분석합니다.</h1>
          <p>
            네이버 공개 RSS에서 확인 가능한 활동성과 주제 일관성을 분석합니다.
            확인할 수 없는 값은 0점으로 만들지 않고 미관측으로 표시합니다.
          </p>
        </div>
      </section>

      <BlogAnalysisClient />
    </main>
  );
}
