export type Severity = "Critical" | "High" | "Medium" | "Low";

export type Issue = {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  category: "SEO" | "AEO" | "GEO" | "E-E-A-T" | "Technical";
};

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  predictedEffect: string;
  impactPoints: number;
  target: "SEO" | "AEO" | "GEO" | "Overall";
};

export type HeadingCounts = {
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
};

export type SchemaPresence = {
  types: string[];
  hasFaqPage: boolean;
  hasHowTo: boolean;
  hasOrganization: boolean;
  hasPerson: boolean;
  hasBreadcrumbList: boolean;
  hasArticle: boolean;
  hasWebSite: boolean;
  rawCount: number;
};

export type AnalysisSignals = {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  headings: HeadingCounts;
  headingTexts: { level: number; text: string }[];
  internalLinks: number;
  externalLinks: number;
  imagesTotal: number;
  imagesWithAlt: number;
  imagesMissingAlt: number;
  canonical: string | null;
  robotsMeta: string | null;
  jsonLdCount: number;
  schema: SchemaPresence;
  hasAuthor: boolean;
  authorText: string | null;
  openGraph: {
    title: boolean;
    description: boolean;
    image: boolean;
    url: boolean;
    type: boolean;
  };
  twitterCard: {
    card: boolean;
    title: boolean;
    description: boolean;
    image: boolean;
  };
  wordCount: number;
  hasFaqLikeStructure: boolean;
  hasCitationMarkers: boolean;
  hasLlmsTxt: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  contentLanguage: string | null;
};

export type ScoreBreakdown = {
  seo: number;
  aeo: number;
  geo: number;
  overall: number;
};

/** 8-axis radar (SEO / AEO / GEO + diagnostic sub-scores) */
export type RadarScores = {
  seo: number;
  aeo: number;
  geo: number;
  eeat: number;
  entity: number;
  schema: number;
  readability: number;
  citationQuality: number;
};

export type AiEstimateScores = {
  chatgpt: number;
  gemini: number;
  claude: number;
  perplexity: number;
};

export type PredictedScores = ScoreBreakdown & {
  note: string;
};

export type AnalysisResult = {
  url: string;
  analyzedAt: string;
  mode: "live" | "demo";
  scores: ScoreBreakdown;
  /** Radar chart axes — includes SEO/AEO/GEO and five diagnostic axes */
  radarScores: RadarScores;
  aiEstimates: AiEstimateScores;
  predictedScores: PredictedScores;
  issues: Issue[];
  recommendations: Recommendation[];
  signals: AnalysisSignals;
  coreWebVitals: {
    lcp: "未測定";
    inp: "未測定";
    cls: "未測定";
    note: string;
  };
  disclaimer: string;
};

export type AnalyzeApiSuccess = {
  ok: true;
  result: AnalysisResult;
};

export type AnalyzeApiError = {
  ok: false;
  error: string;
  code?: string;
};

export type AnalyzeApiResponse = AnalyzeApiSuccess | AnalyzeApiError;
