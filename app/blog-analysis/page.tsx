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

      <section className="blog-analysis-page-head">
        <div>
          <h1>블로그 분석</h1>
          <p>
            네이버 공개 데이터로 활동성·콘텐츠 구조·검색 관측 근거를 확인합니다.
          </p>
        </div>
        <div className="blog-analysis-page-meta">
          <span>결과 저장 안 함</span>
          <span>·</span>
          <span>미관측은 0점 처리 안 함</span>
        </div>
      </section>

      <BlogAnalysisClient />
    </main>
  );
}
