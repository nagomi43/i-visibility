import type { AnalysisSignals } from "./types";
import { buildAnalysisResult } from "./score";

const demoSignals: AnalysisSignals = {
  title: "AI Visibility Score — デモページ（サンプル企業ブログ）",
  titleLength: 38,
  metaDescription:
    "生成AI時代のSEO/AEO/GEOをわかりやすく解説するサンプル記事です。構造化データとFAQのベストプラクティスを紹介します。",
  metaDescriptionLength: 72,
  headings: { h1: 1, h2: 4, h3: 3, h4: 0, h5: 0, h6: 0 },
  headingTexts: [
    { level: 1, text: "生成AIに引用されやすいコンテンツの作り方" },
    { level: 2, text: "SEOとAEOの違いとは？" },
    { level: 2, text: "よくある質問" },
    { level: 2, text: "構造化データの重要性" },
    { level: 2, text: "まとめ" },
    { level: 3, text: "FAQPageを使う理由" },
    { level: 3, text: "著者情報の書き方" },
    { level: 3, text: "llms.txtとは" },
  ],
  internalLinks: 8,
  externalLinks: 3,
  imagesTotal: 4,
  imagesWithAlt: 2,
  imagesMissingAlt: 2,
  canonical: "https://demo.ai-visibility.score/blog/ai-citation",
  robotsMeta: "index, follow",
  jsonLdCount: 1,
  schema: {
    types: ["Article", "Organization"],
    hasFaqPage: false,
    hasHowTo: false,
    hasOrganization: true,
    hasPerson: false,
    hasBreadcrumbList: false,
    hasArticle: true,
    hasWebSite: false,
    rawCount: 1,
  },
  hasAuthor: false,
  authorText: null,
  openGraph: {
    title: true,
    description: true,
    image: true,
    url: true,
    type: true,
  },
  twitterCard: {
    card: true,
    title: true,
    description: false,
    image: true,
  },
  wordCount: 620,
  hasFaqLikeStructure: true,
  hasCitationMarkers: false,
  hasLlmsTxt: false,
  hasRobotsTxt: true,
  hasSitemap: true,
  contentLanguage: "ja",
};

export function getDemoAnalysisResult() {
  return buildAnalysisResult(
    "https://demo.ai-visibility.score/blog/ai-citation",
    demoSignals,
    "demo"
  );
}
