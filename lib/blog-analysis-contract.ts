export type BlogIdentity = {
  provider: "naver";
  blogId: string;
  canonicalUrl: string;
};

export type SignalSource =
  | "naver-blog-public"
  | "naver-search"
  | "naver-datalab"
  | "user-provided"
  | "historical-import"
  | "fixture";

export type AnalysisSignal<T> = {
  value: T | null;
  available: boolean;
  source: SignalSource;
  observedAt: string;
  note?: string;
};

export type BlogAnalysisSignals = {
  postsLast30Days: AnalysisSignal<number>;
  daysSinceLastPost: AnalysisSignal<number>;
  searchVisibleCount: AnalysisSignal<number>;
  searchObservedCount: AnalysisSignal<number>;
  topicConcentration: AnalysisSignal<number>;
  returningAudienceRatio: AnalysisSignal<number>;
  recentPostCompleteness: AnalysisSignal<number>;
  historicalLegacyGrade?: AnalysisSignal<string>;
};

export type DimensionKey =
  | "activity"
  | "visibility"
  | "consistency"
  | "audience"
  | "content";

export type AnalysisDimension = {
  key: DimensionKey;
  label: string;
  weight: number;
  available: boolean;
  score: number | null;
  reasons: string[];
  sources: SignalSource[];
};

export type BlogAnalysisResult = {
  blog: BlogIdentity;
  score: number | null;
  band: "START" | "GROW" | "STABLE" | "STRONG" | null;
  coverage: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  dimensions: AnalysisDimension[];
  historicalReference: {
    grade: string;
    source: SignalSource;
    observedAt: string;
  } | null;
  disclaimer: string;
};
