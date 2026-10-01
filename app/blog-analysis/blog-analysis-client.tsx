"use client";

import { FormEvent, useState } from "react";

type Dimension = {
  key: string;
  label: string;
  weight: number;
  available: boolean;
  score: number | null;
  reasons: string[];
  sources: string[];
};

type EvidencePost = {
  title: string;
  link: string | null;
  publishedAt: string | null;
  categories: string[];
};

type AnalysisResponse = {
  schemaVersion: number;
  analyzedAt: string;
  source: {
    kind: string;
    url: string;
  };
  analysis: {
    blog: {
      blogId: string;
      canonicalUrl: string;
    };
    score: number | null;
    band: string | null;
    coverage: number;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    dimensions: Dimension[];
    disclaimer: string;
  };
  evidence: {
    totalItems: number;
    categoryCoverage: number;
    posts: EvidencePost[];
  };
};

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

const BAND_LABEL: Record<string, string> = {
  START: "시작 단계",
  GROW: "성장 단계",
  STABLE: "안정 단계",
  STRONG: "강한 활동",
};

const CONFIDENCE_LABEL = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
};

function errorMessage(code?: string) {
  switch (code) {
    case "INVALID_INPUT":
    case "INVALID_BLOG":
      return "네이버 블로그 ID 또는 URL을 확인해 주세요.";
    case "RSS_TIMEOUT":
      return "네이버 블로그 응답이 늦습니다. 잠시 후 다시 시도해 주세요.";
    case "RSS_TOO_LARGE":
      return "블로그 피드가 너무 커서 분석하지 못했습니다.";
    case "INVALID_RSS":
      return "공개 RSS를 읽지 못했습니다. 블로그 RSS 공개 상태를 확인해 주세요.";
    case "RSS_UPSTREAM_ERROR":
      return "네이버 공개 RSS를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    default:
      return "분석 중 문제가 발생했습니다. 다시 시도해 주세요.";
  }
}

function formatDate(value: string | null) {
  if (!value) return "날짜 미확인";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 미확인";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function BlogAnalysisClient() {
  const [blog, setBlog] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = blog.trim();
    if (!value || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/v1/blog-analysis/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ blog: value }),
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | AnalysisResponse
        | ApiError
        | null;

      if (!response.ok) {
        const apiError = payload as ApiError | null;
        setResult(null);
        setError(errorMessage(apiError?.error?.code));
        return;
      }

      setResult(payload as AnalysisResponse);
    } catch {
      setResult(null);
      setError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="blog-analysis-workspace" aria-live="polite">
      <div className="blog-analysis-workspace-inner">
        <form className="blog-analysis-form" onSubmit={submit}>
          <label htmlFor="blog-analysis-input">네이버 블로그</label>
          <div className="blog-analysis-form-row">
            <input
              id="blog-analysis-input"
              name="blog"
              value={blog}
              onChange={(event) => setBlog(event.target.value)}
              placeholder="blogId 또는 blog.naver.com/blogId"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" disabled={loading || !blog.trim()}>
              {loading ? "분석 중..." : "분석하기"}
            </button>
          </div>
          <p>
            결과는 저장하지 않습니다. 현재 공개 RSS에서 확인 가능한 정보만 사용합니다.
          </p>
        </form>

        {error && (
          <div className="blog-analysis-error" role="alert">
            <strong>분석하지 못했습니다.</strong>
            <span>{error}</span>
          </div>
        )}

        {!result && !error && (
          <div className="blog-analysis-empty">
            <strong>블로그 ID 또는 URL을 입력해 주세요.</strong>
            <p>
              점수보다 어떤 근거를 실제로 관측했는지 함께 보여드립니다.
            </p>
          </div>
        )}

        {result && (
          <div className="blog-analysis-results">
            <section className="blog-analysis-summary">
              <div className="blog-analysis-summary-main">
                <div>
                  <span>Re:Place 자체 분석</span>
                  <h2>{result.analysis.blog.blogId}</h2>
                  <a
                    href={result.analysis.blog.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    블로그 열기
                  </a>
                </div>

                <div className="blog-analysis-score" aria-label="분석 점수">
                  <strong>
                    {result.analysis.score === null ? "—" : result.analysis.score}
                  </strong>
                  <span>/ 100</span>
                </div>
              </div>

              <div className="blog-analysis-summary-metrics">
                <div>
                  <span>단계</span>
                  <strong>
                    {result.analysis.band
                      ? BAND_LABEL[result.analysis.band] ?? result.analysis.band
                      : "판단 보류"}
                  </strong>
                </div>
                <div>
                  <span>분석 커버리지</span>
                  <strong>{Math.round(result.analysis.coverage * 100)}%</strong>
                </div>
                <div>
                  <span>신뢰도</span>
                  <strong>
                    {CONFIDENCE_LABEL[result.analysis.confidence]}
                  </strong>
                </div>
                <div>
                  <span>RSS 글 수</span>
                  <strong>{result.evidence.totalItems}건</strong>
                </div>
              </div>

              <p className="blog-analysis-disclaimer">
                {result.analysis.disclaimer}
              </p>
            </section>

            <section className="blog-analysis-section">
              <div className="blog-analysis-section-head">
                <div>
                  <span>DIMENSIONS</span>
                  <h2>분석 근거</h2>
                </div>
                <p>확인할 수 없는 항목은 0점이 아니라 미관측입니다.</p>
              </div>

              <div className="blog-analysis-dimensions">
                {result.analysis.dimensions.map((dimension) => (
                  <article
                    key={dimension.key}
                    className={
                      dimension.available
                        ? "blog-analysis-dimension"
                        : "blog-analysis-dimension unavailable"
                    }
                  >
                    <div className="blog-analysis-dimension-head">
                      <strong>{dimension.label}</strong>
                      <span>
                        {dimension.available && dimension.score !== null
                          ? `${dimension.score}점`
                          : "미관측"}
                      </span>
                    </div>

                    {dimension.available ? (
                      <>
                        <div className="blog-analysis-meter" aria-hidden="true">
                          <i
                            style={{
                              width: `${dimension.score ?? 0}%`,
                            }}
                          />
                        </div>
                        <ul>
                          {dimension.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p>
                        현재 공개 RSS만으로는 이 항목을 신뢰성 있게 계산하지
                        않습니다.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="blog-analysis-section">
              <div className="blog-analysis-section-head">
                <div>
                  <span>EVIDENCE</span>
                  <h2>최근 글 근거</h2>
                </div>
                <p>
                  카테고리 관측률 {Math.round(result.evidence.categoryCoverage * 100)}%
                </p>
              </div>

              <div className="blog-analysis-evidence-list">
                {result.evidence.posts.map((post, index) => (
                  <article key={post.link ?? `${post.title}-${index}`}>
                    <div>
                      <span>{formatDate(post.publishedAt)}</span>
                      {post.categories[0] && <em>{post.categories[0]}</em>}
                    </div>
                    <strong>{post.title}</strong>
                    {post.link && (
                      <a href={post.link} target="_blank" rel="noreferrer">
                        원문 보기
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <footer className="blog-analysis-source-note">
              <span>관측 시각 {formatDate(result.analyzedAt)}</span>
              <span>데이터 출처: 네이버 블로그 공개 RSS</span>
              <span>분석 결과는 저장되지 않음</span>
            </footer>
          </div>
        )}
      </div>
    </section>
  );
}
