import type {
  AiEstimateScores,
  AnalysisResult,
  AnalysisSignals,
  Issue,
  PredictedScores,
  RadarScores,
  Recommendation,
  ScoreBreakdown,
  Severity,
} from "./types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Award a slice of a bucket (0–max) without overshooting. */
function bucket(max: number, ratio: number): number {
  const r = Math.max(0, Math.min(1, ratio));
  return max * r;
}

function ogRatio(og: AnalysisSignals["openGraph"]): number {
  const keys = ["title", "description", "image", "url", "type"] as const;
  return keys.filter((k) => og[k]).length / keys.length;
}

function twitterRatio(tw: AnalysisSignals["twitterCard"]): number {
  const keys = ["card", "title", "description", "image"] as const;
  return keys.filter((k) => tw[k]).length / keys.length;
}

/**
 * SEO — max exactly 100 when all buckets are perfect.
 * Incomplete OG / Twitter / missing alt cannot reach 100.
 *
 * Title 14 + Description 12 + H1 12 + Headings 8 + Internal 6 + External 4
 * + Alt 10 + Canonical 6 + Robots meta 4 + OG 10 + Twitter 6
 * + robots.txt 4 + sitemap 4 = 100
 */
export function computeSeoScore(s: AnalysisSignals): number {
  let score = 0;

  // Title 0–14
  if (s.title) {
    score += 6;
    if (s.titleLength >= 30 && s.titleLength <= 60) score += 8;
    else if (s.titleLength >= 20 && s.titleLength <= 70) score += 5;
    else score += 2;
  }

  // Description 0–12
  if (s.metaDescription) {
    score += 4;
    if (s.metaDescriptionLength >= 70 && s.metaDescriptionLength <= 160)
      score += 8;
    else if (s.metaDescriptionLength >= 50 && s.metaDescriptionLength <= 180)
      score += 5;
    else score += 2;
  }

  // H1 0–12 (exactly one for full credit)
  if (s.headings.h1 === 1) score += 12;
  else if (s.headings.h1 > 1) score += 4;

  // Heading depth 0–8
  if (s.headings.h2 >= 2) score += 5;
  else if (s.headings.h2 === 1) score += 3;
  if (s.headings.h3 >= 1) score += 3;

  // Internal links 0–6
  if (s.internalLinks >= 5) score += 6;
  else if (s.internalLinks >= 3) score += 4;
  else if (s.internalLinks >= 1) score += 2;

  // External links 0–4
  if (s.externalLinks >= 2) score += 4;
  else if (s.externalLinks >= 1) score += 2;

  // Image alt 0–10 — missing alt blocks full SEO
  if (s.imagesTotal === 0) {
    score += 10;
  } else {
    score += bucket(10, s.imagesWithAlt / s.imagesTotal);
  }

  // Canonical 0–6
  if (s.canonical) score += 6;

  // Robots meta 0–4 (noindex → 0)
  if (s.robotsMeta) {
    if (!/noindex/i.test(s.robotsMeta)) score += 4;
  } else {
    score += 2; // absence is milder than noindex
  }

  // Open Graph 0–10 — incomplete OG cannot hit 100
  score += bucket(10, ogRatio(s.openGraph));

  // Twitter Card 0–6 — incomplete Twitter cannot hit 100
  score += bucket(6, twitterRatio(s.twitterCard));

  // Technical files 0–8
  if (s.hasRobotsTxt) score += 4;
  if (s.hasSitemap) score += 4;

  return clamp(score);
}

/**
 * AEO — max exactly 100.
 * FAQPage is a modest optional bucket (8), not a dominant signal.
 *
 * FAQ-like 12 + FAQPage 8 + HowTo 10 + H2 14 + H3 6 + Description 10
 * + Body 18 + JSON-LD 8 + Article 6 + Breadcrumb 4 + Language 4 = 100
 */
export function computeAeoScore(s: AnalysisSignals): number {
  let score = 0;

  // Answer-friendly content structure 0–12
  if (s.hasFaqLikeStructure) score += 12;

  // FAQPage schema 0–8 (nice-to-have, not mandatory for high AEO)
  if (s.schema.hasFaqPage) score += 8;
  else if (s.hasFaqLikeStructure) score += 2; // partial credit for content-only FAQ

  // HowTo 0–10
  if (s.schema.hasHowTo) score += 10;

  // Clear section headings 0–14
  if (s.headings.h2 >= 3) score += 14;
  else if (s.headings.h2 === 2) score += 10;
  else if (s.headings.h2 === 1) score += 6;

  // Sub-structure 0–6
  if (s.headings.h3 >= 2) score += 6;
  else if (s.headings.h3 === 1) score += 3;

  // Snippet-ready description 0–10
  if (s.metaDescription && s.metaDescriptionLength >= 70) score += 10;
  else if (s.metaDescription) score += 5;

  // Body depth for extractive answers 0–18
  if (s.wordCount >= 600) score += 18;
  else if (s.wordCount >= 400) score += 14;
  else if (s.wordCount >= 250) score += 10;
  else if (s.wordCount >= 120) score += 6;
  else if (s.wordCount >= 50) score += 3;

  // Machine-readable answer scaffolding 0–8
  if (s.jsonLdCount >= 1) score += 8;

  // Article schema 0–6
  if (s.schema.hasArticle) score += 6;

  // Breadcrumb 0–4
  if (s.schema.hasBreadcrumbList) score += 4;

  // Language 0–4
  if (s.contentLanguage) score += 4;

  return clamp(score);
}

/**
 * GEO — max exactly 100.
 * llms.txt is a small emerging signal (4 pts), not a major deduction driver.
 *
 * Schema 12 + Types 6 + Org 10 + Person 8 + Author 12 + Article 6
 * + Citations 14 + llms.txt 4 + Canonical 5 + Sitemap 4 + OG 4
 * + Content 7 + Breadcrumb 3 + External 5 = 100
 */
export function computeGeoScore(s: AnalysisSignals): number {
  let score = 0;

  if (s.schema.rawCount >= 1 || s.jsonLdCount >= 1) score += 12;
  if (s.schema.types.length >= 2) score += 6;
  if (s.schema.hasOrganization) score += 10;
  if (s.schema.hasPerson) score += 8;
  if (s.hasAuthor) score += 12;
  if (s.schema.hasArticle) score += 6;
  if (s.hasCitationMarkers) score += 14;

  // Emerging / optional AI crawler hint — small weight only
  if (s.hasLlmsTxt) score += 4;

  if (s.canonical) score += 5;
  if (s.hasSitemap) score += 4;
  if (s.openGraph.title && s.openGraph.description) score += 4;

  if (s.wordCount >= 500) score += 7;
  else if (s.wordCount >= 250) score += 4;
  else if (s.wordCount >= 100) score += 2;

  if (s.schema.hasBreadcrumbList) score += 3;

  if (s.externalLinks >= 3) score += 5;
  else if (s.externalLinks >= 1) score += 3;

  return clamp(score);
}

export function computeOverall(seo: number, aeo: number, geo: number): number {
  return clamp(seo * 0.3 + aeo * 0.35 + geo * 0.35);
}

/** E-E-A-T proxies from HTML signals (max 100). */
export function computeEeatScore(s: AnalysisSignals): number {
  let score = 0;
  if (s.hasAuthor) score += 28;
  if (s.schema.hasPerson) score += 18;
  if (s.schema.hasOrganization) score += 18;
  if (s.hasCitationMarkers) score += 16;
  if (s.externalLinks >= 2) score += 10;
  else if (s.externalLinks >= 1) score += 5;
  if (s.wordCount >= 400) score += 10;
  else if (s.wordCount >= 200) score += 5;
  return clamp(score);
}

/** Entity clarity: who / what / site identity (max 100). */
export function computeEntityScore(s: AnalysisSignals): number {
  let score = 0;
  if (s.schema.hasOrganization) score += 28;
  if (s.schema.hasPerson) score += 22;
  if (s.schema.hasWebSite) score += 14;
  if (s.schema.hasArticle) score += 12;
  if (s.hasAuthor) score += 12;
  if (s.openGraph.type) score += 6;
  if (s.schema.types.length >= 2) score += 6;
  return clamp(score);
}

/** Schema.org / JSON-LD richness (max 100). FAQ is a small optional slice. */
export function computeSchemaScore(s: AnalysisSignals): number {
  let score = 0;
  if (s.jsonLdCount >= 1 || s.schema.rawCount >= 1) score += 30;
  if (s.schema.types.length >= 3) score += 18;
  else if (s.schema.types.length >= 2) score += 12;
  else if (s.schema.types.length === 1) score += 6;
  if (s.schema.hasArticle) score += 12;
  if (s.schema.hasOrganization || s.schema.hasPerson) score += 14;
  if (s.schema.hasBreadcrumbList) score += 10;
  // FAQ / HowTo optional richness (not required for a solid schema score)
  if (s.schema.hasFaqPage) score += 8;
  if (s.schema.hasHowTo) score += 8;
  return clamp(score);
}

/** Readability / extractability for humans and answer engines (max 100). */
export function computeReadabilityScore(s: AnalysisSignals): number {
  let score = 0;
  if (s.headings.h1 === 1) score += 16;
  else if (s.headings.h1 > 1) score += 6;
  if (s.headings.h2 >= 3) score += 18;
  else if (s.headings.h2 >= 1) score += 10;
  if (s.headings.h3 >= 1) score += 8;
  if (s.metaDescription && s.metaDescriptionLength >= 70) score += 14;
  else if (s.metaDescription) score += 7;
  if (s.wordCount >= 600) score += 22;
  else if (s.wordCount >= 300) score += 16;
  else if (s.wordCount >= 150) score += 10;
  else if (s.wordCount >= 50) score += 5;
  if (s.contentLanguage) score += 8;
  if (s.hasFaqLikeStructure) score += 8;
  if (s.title && s.titleLength >= 20 && s.titleLength <= 70) score += 6;
  return clamp(score);
}

/** Citation quality / citability signals (max 100). */
export function computeCitationQualityScore(s: AnalysisSignals): number {
  let score = 0;
  if (s.hasCitationMarkers) score += 36;
  if (s.externalLinks >= 3) score += 22;
  else if (s.externalLinks >= 1) score += 12;
  if (s.hasAuthor) score += 14;
  if (s.canonical) score += 12;
  if (s.schema.hasOrganization || s.schema.hasPerson) score += 10;
  // llms.txt is an optional citation-policy hint, small weight
  if (s.hasLlmsTxt) score += 6;
  return clamp(score);
}

export function computeRadarScores(
  seo: number,
  aeo: number,
  geo: number,
  s: AnalysisSignals
): RadarScores {
  return {
    seo,
    aeo,
    geo,
    eeat: computeEeatScore(s),
    entity: computeEntityScore(s),
    schema: computeSchemaScore(s),
    readability: computeReadabilityScore(s),
    citationQuality: computeCitationQualityScore(s),
  };
}

export function computeAiEstimates(
  scores: ScoreBreakdown,
  radar: RadarScores,
  s: AnalysisSignals
): AiEstimateScores {
  // Rule-based estimates — NOT live ranking measurements
  const base = scores.overall;
  // Modest FAQ affinity — not a large swing
  const faqBoost =
    (s.schema.hasFaqPage ? 2 : 0) + (s.hasFaqLikeStructure ? 2 : 0);
  const schemaBoost = s.jsonLdCount > 0 ? 3 : -2;
  const trustBoost =
    (s.hasAuthor ? 2 : 0) +
    (s.schema.hasOrganization ? 2 : 0) +
    (s.hasCitationMarkers ? 3 : 0);
  // Emerging signal only
  const llmsBoost = s.hasLlmsTxt ? 2 : 0;
  const contentBoost = s.wordCount >= 400 ? 2 : 0;
  const citeAxis = radar.citationQuality * 0.04;
  const eeatAxis = radar.eeat * 0.03;

  return {
    chatgpt: clamp(
      base * 0.92 + faqBoost + schemaBoost + contentBoost + 2 + citeAxis
    ),
    gemini: clamp(
      base * 0.9 +
        schemaBoost +
        trustBoost +
        (s.hasSitemap ? 3 : 0) +
        eeatAxis
    ),
    claude: clamp(
      base * 0.88 +
        trustBoost +
        contentBoost +
        (s.hasCitationMarkers ? 4 : 0) +
        eeatAxis
    ),
    perplexity: clamp(
      base * 0.94 +
        faqBoost +
        llmsBoost +
        (s.hasCitationMarkers ? 3 : 0) +
        schemaBoost +
        citeAxis
    ),
  };
}

function issue(
  id: string,
  severity: Severity,
  title: string,
  description: string,
  category: Issue["category"]
): Issue {
  return { id, severity, title, description, category };
}

export function detectIssues(s: AnalysisSignals): Issue[] {
  const issues: Issue[] = [];

  if (!s.title) {
    issues.push(
      issue(
        "title-missing",
        "Critical",
        "タイトルがありません",
        "titleタグが見つかりません。検索・AI要約の第一印象が損なわれます。",
        "SEO"
      )
    );
  } else if (s.titleLength > 70) {
    issues.push(
      issue(
        "title-long",
        "Medium",
        "タイトルが長すぎます",
        `タイトルが${s.titleLength}文字です。60文字前後に収めると表示崩れを防げます。`,
        "SEO"
      )
    );
  } else if (s.titleLength < 20) {
    issues.push(
      issue(
        "title-short",
        "Medium",
        "タイトルが短すぎます",
        `タイトルが${s.titleLength}文字です。主題が伝わる30〜60文字が目安です。`,
        "SEO"
      )
    );
  }

  if (!s.metaDescription) {
    issues.push(
      issue(
        "desc-missing",
        "High",
        "メタディスクリプションがありません",
        "descriptionメタが無いと、スニペット候補とAIの要約材料が不足します。",
        "SEO"
      )
    );
  } else if (s.metaDescriptionLength < 50) {
    issues.push(
      issue(
        "desc-short",
        "Medium",
        "Descriptionが短すぎます",
        `ディスクリプションが${s.metaDescriptionLength}文字です。70〜160文字が目安です。`,
        "SEO"
      )
    );
  } else if (s.metaDescriptionLength > 180) {
    issues.push(
      issue(
        "desc-long",
        "Low",
        "Descriptionが長すぎます",
        `ディスクリプションが${s.metaDescriptionLength}文字です。160文字前後に調整してください。`,
        "SEO"
      )
    );
  }

  if (s.headings.h1 === 0) {
    issues.push(
      issue(
        "h1-missing",
        "Critical",
        "H1タグがありません",
        "ページの主題を示すH1が必要です。",
        "SEO"
      )
    );
  } else if (s.headings.h1 > 1) {
    issues.push(
      issue(
        "h1-multiple",
        "High",
        `H1タグが${s.headings.h1}つあります`,
        "H1は原則1つにまとめ、階層をH2以降で整理してください。",
        "SEO"
      )
    );
  }

  if (s.headings.h2 === 0) {
    issues.push(
      issue(
        "h2-missing",
        "Medium",
        "H2見出しがありません",
        "セクション構造が弱いと、AIが論点を抽出しにくくなります。",
        "AEO"
      )
    );
  }

  if (s.imagesMissingAlt > 0) {
    issues.push(
      issue(
        "img-alt",
        s.imagesMissingAlt >= 3 ? "High" : "Medium",
        "画像のalt属性が不足しています",
        `${s.imagesTotal}枚中${s.imagesMissingAlt}枚にaltがありません。SEO満点にはすべての画像にaltが必要です。`,
        "SEO"
      )
    );
  }

  if (!s.canonical) {
    issues.push(
      issue(
        "canonical-missing",
        "Medium",
        "canonicalが設定されていません",
        "正規URLが不明だと重複判定や引用元の特定が難しくなります。",
        "Technical"
      )
    );
  }

  if (s.robotsMeta && /noindex/i.test(s.robotsMeta)) {
    issues.push(
      issue(
        "noindex",
        "Critical",
        "robots meta に noindex があります",
        "インデックス・引用対象から外れる可能性が高い設定です。",
        "Technical"
      )
    );
  }

  if (s.jsonLdCount === 0) {
    issues.push(
      issue(
        "jsonld-missing",
        "High",
        "JSON-LDがありません",
        "構造化データが無いと、AI/検索エンジンがエンティティを理解しにくくなります。",
        "GEO"
      )
    );
  }

  // FAQ Schema: only when content already looks like FAQ — never a universal High
  if (!s.schema.hasFaqPage && s.hasFaqLikeStructure) {
    issues.push(
      issue(
        "faq-schema",
        "Medium",
        "FAQらしい内容に Schema がありません",
        "ページにQ&A構造があるため、FAQPageマークアップを付けるとAEOが改善しやすくなります。全ページ必須ではありません。",
        "AEO"
      )
    );
  }

  if (!s.schema.hasHowTo && !s.hasFaqLikeStructure) {
    issues.push(
      issue(
        "howto-missing",
        "Low",
        "HowTo Schemaがありません",
        "手順系コンテンツがある場合、HowToマークアップが回答抽出に有利です。",
        "AEO"
      )
    );
  }

  if (!s.schema.hasOrganization && !s.schema.hasPerson) {
    issues.push(
      issue(
        "org-person",
        "Medium",
        "Organization / Person Schemaが不足しています",
        "発行主体の明確化はE-E-A-Tと生成AIの信頼評価に寄与します。",
        "E-E-A-T"
      )
    );
  }

  if (!s.schema.hasBreadcrumbList) {
    issues.push(
      issue(
        "breadcrumb",
        "Low",
        "BreadcrumbListがありません",
        "パンくず構造化データはサイト階層の理解を助けます。",
        "SEO"
      )
    );
  }

  if (!s.hasAuthor) {
    issues.push(
      issue(
        "author-missing",
        "High",
        "Author情報が不足しています",
        "著者情報はE-E-A-TとAIの出典信頼度に影響します。",
        "E-E-A-T"
      )
    );
  }

  if (!s.openGraph.title || !s.openGraph.description || !s.openGraph.image) {
    issues.push(
      issue(
        "og-incomplete",
        "Medium",
        "Open Graphが不完全です",
        "og:title / description / image を揃えると共有時の可読性が上がり、SEO満点にも必要です。",
        "SEO"
      )
    );
  }

  if (!s.twitterCard.card || !s.twitterCard.title || !s.twitterCard.description || !s.twitterCard.image) {
    issues.push(
      issue(
        "twitter-incomplete",
        "Low",
        "Twitter Cardが不完全です",
        "twitter:card / title / description / image を揃えるとSNS表示が安定し、SEO満点にも寄与します。",
        "SEO"
      )
    );
  }

  if (s.wordCount < 150) {
    issues.push(
      issue(
        "thin-content",
        "High",
        "本文量が少ないです",
        `推定本文量は約${s.wordCount}語です。AIが引用できる具体情報が不足している可能性があります。`,
        "AEO"
      )
    );
  }

  if (!s.hasFaqLikeStructure) {
    issues.push(
      issue(
        "faq-structure",
        "Low",
        "FAQやQ&Aらしい構造は見つかりませんでした",
        "必須ではありません。回答エンジン向けにQ&A見出しを置くとAEOが上がりやすくなります。",
        "AEO"
      )
    );
  }

  if (!s.hasCitationMarkers) {
    issues.push(
      issue(
        "citations",
        "Medium",
        "引用出典表記が見つかりません",
        "出典・参考リンクは生成AIが「引用しやすい」信頼シグナルになります。",
        "GEO"
      )
    );
  }

  // llms.txt: emerging optional signal — Low only, not a major problem
  if (!s.hasLlmsTxt) {
    issues.push(
      issue(
        "llms-txt",
        "Low",
        "llms.txtは未公開です（提案段階のシグナル）",
        "llms.txt はAI向けサイト案内として議論が進む新しい提案です。未設置でも重大な欠陥ではありません。",
        "GEO"
      )
    );
  }

  if (!s.hasRobotsTxt) {
    issues.push(
      issue(
        "robots-txt",
        "Medium",
        "robots.txtがありません",
        "クロール制御とサイトマップ案内のために配置を推奨します。",
        "Technical"
      )
    );
  }

  if (!s.hasSitemap) {
    issues.push(
      issue(
        "sitemap",
        "Medium",
        "sitemap.xmlがありません",
        "主要URLの発見性向上のため sitemap.xml を公開してください。",
        "Technical"
      )
    );
  }

  if (s.internalLinks < 3) {
    issues.push(
      issue(
        "internal-links",
        "Low",
        "内部リンクが少ないです",
        "関連ページへの内部リンクはトピッククラスタ理解に役立ちます。",
        "SEO"
      )
    );
  }

  const order: Record<Severity, number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
    Low: 3,
  };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function buildRecommendations(
  s: AnalysisSignals,
  scores: ScoreBreakdown
): { recommendations: Recommendation[]; predicted: PredictedScores } {
  const recs: Recommendation[] = [];
  let aeoGain = 0;
  let geoGain = 0;
  let seoGain = 0;

  // FAQ: prioritize only when content already looks like FAQ
  if (s.hasFaqLikeStructure && !s.schema.hasFaqPage) {
    const pts = 5;
    aeoGain += pts;
    recs.push({
      id: "rec-faq-schema",
      title: "既存のFAQに FAQPage Schema を付与する",
      description:
        "すでにQ&A構造があるため、FAQPageのJSON-LDを追加するとAEOが改善しやすいです。",
      predictedEffect: `FAQPage Schema でAEOが約${pts}点向上すると予測されます。`,
      impactPoints: pts,
      target: "AEO",
    });
  } else if (!s.hasFaqLikeStructure && !s.schema.hasFaqPage) {
    const pts = 3;
    aeoGain += pts;
    recs.push({
      id: "rec-faq-optional",
      title: "（任意）FAQセクションを検討する",
      description:
        "全サイト必須ではありません。ユーザー質問が多いテーマなら、3つ程度のQ&Aとマークアップが有効です。",
      predictedEffect: `FAQ導入でAEOが最大約${pts}点向上する可能性があります。`,
      impactPoints: pts,
      target: "AEO",
    });
  }

  if (!s.hasAuthor || !s.schema.hasPerson) {
    const pts = 7;
    geoGain += pts;
    recs.push({
      id: "rec-author",
      title: "AuthorプロフィールとPerson Schemaを追加する",
      description:
        "著者名・肩書・専門領域をページに明示し、Person / author 構造化データを付与します。",
      predictedEffect:
        "Authorプロフィールを追加するとE-E-A-Tが改善され、GEOスコア向上が期待できます。",
      impactPoints: pts,
      target: "GEO",
    });
  }

  // llms.txt: low-impact emerging recommendation
  if (!s.hasLlmsTxt) {
    const pts = 3;
    geoGain += pts;
    recs.push({
      id: "rec-llms",
      title: "（任意・提案段階）llms.txt の公開を検討する",
      description:
        "サイト要約・主要URL・引用ポリシーを /llms.txt に置く新しい提案です。未設置でも致命的ではありません。",
      predictedEffect: `llms.txt 追加でGEOが約${pts}点向上する可能性があります（配点は小さめです）。`,
      impactPoints: pts,
      target: "GEO",
    });
  }

  if (s.jsonLdCount === 0) {
    const pts = 8;
    geoGain += 5;
    aeoGain += 3;
    recs.push({
      id: "rec-jsonld",
      title: "JSON-LD構造化データを実装する",
      description:
        "WebSite / Organization / Article など、ページ種別に合ったSchema.orgを追加します。",
      predictedEffect:
        "JSON-LD実装によりAI/検索エンジンのエンティティ理解が改善します。",
      impactPoints: pts,
      target: "Overall",
    });
  }

  if (!s.metaDescription || s.metaDescriptionLength < 70) {
    const pts = 6;
    seoGain += pts;
    recs.push({
      id: "rec-desc",
      title: "メタディスクリプションを最適化する",
      description:
        "70〜160文字で、誰向けに何がわかるページかを明確に記述します。",
      predictedEffect: `Description最適化でSEOスコアが約${pts}点向上すると予測されます。`,
      impactPoints: pts,
      target: "SEO",
    });
  }

  if (s.headings.h1 !== 1) {
    const pts = 6;
    seoGain += pts;
    recs.push({
      id: "rec-h1",
      title: "H1を1つに整理する",
      description: "ページ主題を単一のH1に集約し、詳細はH2/H3へ分割します。",
      predictedEffect: `見出し整理でSEOスコアが約${pts}点向上すると予測されます。`,
      impactPoints: pts,
      target: "SEO",
    });
  }

  if (s.imagesMissingAlt > 0) {
    const pts = 5;
    seoGain += pts;
    recs.push({
      id: "rec-alt",
      title: "画像のalt属性を補完する",
      description:
        "装飾画像以外には内容が伝わる代替テキストを設定します。alt不足があるとSEO満点になりません。",
      predictedEffect: `alt整備でSEOが最大約${pts}点改善する見込みです。`,
      impactPoints: pts,
      target: "SEO",
    });
  }

  const ogIncomplete =
    !s.openGraph.title || !s.openGraph.description || !s.openGraph.image;
  if (ogIncomplete) {
    const pts = 5;
    seoGain += pts;
    recs.push({
      id: "rec-og",
      title: "Open Graphを完成させる",
      description: "og:title / description / image / url / type を揃えます。",
      predictedEffect: `OG整備でSEOが約${pts}点向上し、満点に近づきます。`,
      impactPoints: pts,
      target: "SEO",
    });
  }

  if (
    !s.twitterCard.card ||
    !s.twitterCard.title ||
    !s.twitterCard.description ||
    !s.twitterCard.image
  ) {
    const pts = 3;
    seoGain += pts;
    recs.push({
      id: "rec-twitter",
      title: "Twitter Cardメタを揃える",
      description:
        "twitter:card / title / description / image を設定します（SEO満点に必要）。",
      predictedEffect: `Twitter Card整備でSEOが約${pts}点向上すると予測されます。`,
      impactPoints: pts,
      target: "SEO",
    });
  }

  if (!s.hasCitationMarkers) {
    const pts = 8;
    geoGain += pts;
    recs.push({
      id: "rec-cite",
      title: "出典・参考リンクを明示する",
      description:
        "主張の根拠となる一次情報へのリンクや参考文献セクションを追加します。",
      predictedEffect: `引用出典の明示でGEOスコアが約${pts}点向上すると予測されます。`,
      impactPoints: pts,
      target: "GEO",
    });
  }

  if (!s.hasSitemap || !s.hasRobotsTxt) {
    const pts = 5;
    seoGain += pts;
    recs.push({
      id: "rec-tech",
      title: "robots.txt と sitemap.xml を整備する",
      description: "クロール許可範囲と主要URL一覧を公開し、発見性を高めます。",
      predictedEffect: "テクニカルSEO基盤の整備でクロール効率が改善します。",
      impactPoints: pts,
      target: "SEO",
    });
  }

  if (s.wordCount < 400) {
    const pts = 7;
    aeoGain += 4;
    seoGain += 3;
    recs.push({
      id: "rec-content",
      title: "本文を充実させ具体的な回答を書く",
      description:
        "定義・手順・数値・比較など、AIが抜き出しやすい具体情報を段落で追加します。",
      predictedEffect:
        "本文拡充によりAEO/SEOの双方で引用候補としての適性が上がります。",
      impactPoints: pts,
      target: "Overall",
    });
  }

  // Prefer higher-impact recs; keep llms near the end of list by impact
  recs.sort((a, b) => b.impactPoints - a.impactPoints);

  const predictedSeo = clamp(scores.seo + Math.min(seoGain, 18));
  const predictedAeo = clamp(scores.aeo + Math.min(aeoGain, 16));
  const predictedGeo = clamp(scores.geo + Math.min(geoGain, 18));
  const predictedOverall = clamp(
    predictedSeo * 0.3 + predictedAeo * 0.35 + predictedGeo * 0.35
  );

  return {
    recommendations: recs.slice(0, 8),
    predicted: {
      seo: predictedSeo,
      aeo: predictedAeo,
      geo: predictedGeo,
      overall: predictedOverall,
      note: "改善後スコアはルールベースの予測値であり、実装品質や競合状況により変動します。",
    },
  };
}

export function buildAnalysisResult(
  url: string,
  signals: AnalysisSignals,
  mode: "live" | "demo"
): AnalysisResult {
  const seo = computeSeoScore(signals);
  const aeo = computeAeoScore(signals);
  const geo = computeGeoScore(signals);
  const overall = computeOverall(seo, aeo, geo);
  const scores: ScoreBreakdown = { seo, aeo, geo, overall };
  const radarScores = computeRadarScores(seo, aeo, geo, signals);
  const issues = detectIssues(signals);
  const { recommendations, predicted } = buildRecommendations(signals, scores);
  const aiEstimates = computeAiEstimates(scores, radarScores, signals);

  return {
    url,
    analyzedAt: new Date().toISOString(),
    mode,
    scores,
    radarScores,
    aiEstimates,
    predictedScores: predicted,
    issues,
    recommendations,
    signals,
    coreWebVitals: {
      lcp: "未測定",
      inp: "未測定",
      cls: "未測定",
      note: "MVPでは PageSpeed Insights / Lighthouse API を使用しないため、Core Web Vitals は未測定です。",
    },
    disclaimer:
      "本スコアはHTMLシグナルに基づく再現可能なルールベース推定です。ChatGPT・Gemini・Claude・Perplexity等の実際の検索順位や引用頻度を測定したものではありません。",
  };
}
