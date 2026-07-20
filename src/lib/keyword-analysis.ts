import type {
  AnalysisSignals,
  KeywordAnalysis,
  KeywordLocationHit,
  KeywordMatchSignal,
  KeywordScores,
  QuestionCoverage,
} from "./types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  if (!n) return 0;
  let count = 0;
  let idx = 0;
  while (idx <= h.length) {
    const found = h.indexOf(n, idx);
    if (found < 0) break;
    count += 1;
    idx = found + Math.max(n.length, 1);
  }
  return count;
}

function containsKeyword(
  haystack: string | null | undefined,
  keyword: string
): boolean {
  if (!haystack || !keyword) return false;
  return normalizeText(haystack).includes(normalizeText(keyword));
}

function keywordTokens(keyword: string): string[] {
  return normalizeText(keyword)
    .split(/[\s　・／/,、\-–—]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function questionTokens(question: string): string[] {
  const stop = new Set([
    "とは",
    "です",
    "ます",
    "する",
    "した",
    "して",
    "ある",
    "ない",
    "これ",
    "それ",
    "あれ",
    "もの",
    "こと",
    "ため",
    "よう",
    "について",
    "における",
    "どう",
    "なに",
    "何",
    "誰",
    "いつ",
    "どこ",
    "なぜ",
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "what",
    "how",
    "why",
    "when",
    "where",
    "who",
    "which",
    "of",
    "to",
    "in",
    "on",
    "for",
    "and",
    "or",
  ]);
  return normalizeText(question)
    .replace(/[？?！!。．.、,]/g, " ")
    .split(/[\s　]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t));
}

function tokenHitRatio(text: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const n = normalizeText(text);
  const hits = tokens.filter((t) => n.includes(t)).length;
  return hits / tokens.length;
}

function hasConcreteExamples(body: string): boolean {
  const t = body.slice(0, 25000);
  if (
    /例えば|たとえば|具体例|事例|ケーススタディ|for example|e\.g\.|example:/i.test(
      t
    )
  )
    return true;
  // Numbers / stats as weak proxy for concreteness
  const nums = t.match(
    /\d+(\.\d+)?\s*(%|％|円|社|件|人|年|月|日|倍|pt|ポイント)?/g
  );
  return (nums?.length || 0) >= 3;
}

function hasDefinitionStyle(body: string, keyword: string | null): boolean {
  const slice = body.slice(0, 4000);
  if (/とは[、。]|というのは|定義|を指します|is defined as/i.test(slice))
    return true;
  if (keyword) {
    const k = normalizeText(keyword);
    const n = normalizeText(slice);
    // "keyword は …" style near start
    if (n.includes(k) && /は|とは|です|である|を/.test(slice.slice(0, 800)))
      return true;
  }
  return false;
}

type IntentKind = "informational" | "commercial" | "navigational" | "mixed";

function detectIntent(keyword: string, questions: string[]): IntentKind {
  const blob = normalizeText([keyword, ...questions].join(" "));
  if (
    /買い方|購入|料金|価格|比較|おすすめ|ベスト|ランキング|ツール|サービス/.test(
      blob
    )
  )
    return "commercial";
  if (/ログイン|公式|ダウンロード|サイト/.test(blob)) return "navigational";
  if (
    /とは|意味|違い|方法|やり方|仕方|なぜ|理由|仕組み|解説|ガイド|how|what|why/.test(
      blob
    )
  )
    return "informational";
  if (questions.some((q) => /[？?]/.test(q))) return "informational";
  return "mixed";
}

export type KeywordAnalysisInput = {
  keyword?: string | null;
  questions?: string[] | null;
};

export function normalizeKeywordInput(input?: KeywordAnalysisInput | null): {
  keyword: string | null;
  questions: string[];
} {
  const keywordRaw = input?.keyword?.trim() || "";
  const keyword = keywordRaw.length > 0 ? keywordRaw.slice(0, 120) : null;

  const rawQs = Array.isArray(input?.questions) ? input!.questions! : [];
  const questions = rawQs
    .map((q) => (typeof q === "string" ? q.trim() : ""))
    .filter((q) => q.length > 0)
    .slice(0, 3)
    .map((q) => q.slice(0, 200));

  return { keyword, questions };
}

function emptyLocations(): KeywordLocationHit {
  return {
    title: false,
    metaDescription: false,
    h1: false,
    h2h3: false,
    body: false,
    faq: false,
    jsonLd: false,
    citations: false,
    examples: false,
  };
}

/**
 * Always returns a KeywordAnalysis object.
 * Without a main keyword, queryVisibilityScore is null and noKeywordNotice is set.
 */
export function computeKeywordAnalysis(
  signals: AnalysisSignals,
  bodyText: string,
  input?: KeywordAnalysisInput | null
): KeywordAnalysis {
  const { keyword, questions } = normalizeKeywordInput(input);
  const hasKeyword = Boolean(keyword);

  const title = signals.title || "";
  const desc = signals.metaDescription || "";
  const h1Texts = signals.headingTexts
    .filter((h) => h.level === 1)
    .map((h) => h.text)
    .join(" ");
  const h2h3Texts = signals.headingTexts
    .filter((h) => h.level === 2 || h.level === 3)
    .map((h) => h.text)
    .join(" ");
  const allHeadings = signals.headingTexts.map((h) => h.text).join(" ");
  const body = bodyText.slice(0, 40000);
  const corpus = [title, desc, allHeadings, body].join("\n");
  const tokens = keyword ? keywordTokens(keyword) : [];

  const examples = hasConcreteExamples(body);
  const definition = hasDefinitionStyle(body, keyword);

  const locations: KeywordLocationHit = keyword
    ? {
        title: containsKeyword(title, keyword),
        metaDescription: containsKeyword(desc, keyword),
        h1: containsKeyword(h1Texts, keyword),
        h2h3: containsKeyword(h2h3Texts, keyword),
        body: containsKeyword(body, keyword),
        faq:
          signals.hasFaqLikeStructure ||
          signals.schema.hasFaqPage ||
          (tokens.length > 0 &&
            tokenHitRatio(
              body.slice(0, 8000) + allHeadings,
              tokens
            ) >= 0.5 &&
            signals.hasFaqLikeStructure),
        jsonLd:
          signals.jsonLdCount > 0 &&
          (tokens.length === 0 ||
            tokenHitRatio(
              [
                title,
                desc,
                signals.schema.types.join(" "),
              ].join(" "),
              tokens
            ) >= 0.3 ||
            containsKeyword(title, keyword)),
        citations: signals.hasCitationMarkers,
        examples,
      }
    : {
        ...emptyLocations(),
        faq: signals.hasFaqLikeStructure || signals.schema.hasFaqPage,
        jsonLd: signals.jsonLdCount > 0,
        citations: signals.hasCitationMarkers,
        examples,
      };

  // Refine FAQ/jsonLd when keyword present using structural signals too
  if (keyword) {
    locations.faq =
      signals.hasFaqLikeStructure ||
      signals.schema.hasFaqPage ||
      signals.headingTexts.some(
        (h) =>
          /[？?]/.test(h.text) &&
          (containsKeyword(h.text, keyword) ||
            tokenHitRatio(h.text, tokens) >= 0.4)
      );
    locations.jsonLd = signals.jsonLdCount > 0;
  }

  const occurrenceEstimate = keyword
    ? countOccurrences(corpus, keyword)
    : 0;

  // --- Score: キーワード関連性 ---
  let keywordRelevance = 0;
  if (keyword) {
    const partialTitle = tokenHitRatio(title, tokens);
    const partialDesc = tokenHitRatio(desc, tokens);
    const partialH1 = tokenHitRatio(h1Texts, tokens);
    const partialH23 = tokenHitRatio(h2h3Texts, tokens);
    const partialBody = tokenHitRatio(body, tokens);

    keywordRelevance += locations.title ? 24 : partialTitle * 12;
    keywordRelevance += locations.metaDescription ? 14 : partialDesc * 7;
    keywordRelevance += locations.h1 ? 20 : partialH1 * 10;
    keywordRelevance += locations.h2h3 ? 14 : partialH23 * 7;
    keywordRelevance += locations.body ? 18 : partialBody * 9;
    // density bonus (cap)
    if (occurrenceEstimate >= 5) keywordRelevance += 10;
    else if (occurrenceEstimate >= 2) keywordRelevance += 6;
    else if (occurrenceEstimate === 1) keywordRelevance += 3;
    keywordRelevance = clamp(keywordRelevance);
  } else {
    // Structure-only: topical clarity without a target keyword
    keywordRelevance = clamp(
      (signals.title ? 15 : 0) +
        (signals.metaDescription ? 10 : 0) +
        (signals.headings.h1 === 1 ? 15 : 0) +
        Math.min(signals.headings.h2, 4) * 5 +
        (signals.wordCount >= 300 ? 20 : signals.wordCount >= 100 ? 10 : 0) +
        (signals.jsonLdCount > 0 ? 10 : 0)
    );
  }

  // --- Score: 検索意図一致度 ---
  const intent = keyword
    ? detectIntent(keyword, questions)
    : questions.length
      ? detectIntent("", questions)
      : "mixed";

  let searchIntentMatch = 40; // baseline
  if (intent === "informational") {
    searchIntentMatch = 35;
    if (definition) searchIntentMatch += 18;
    if (signals.hasFaqLikeStructure || signals.schema.hasFaqPage)
      searchIntentMatch += 15;
    if (signals.schema.hasHowTo || signals.schema.hasArticle)
      searchIntentMatch += 10;
    if (signals.wordCount >= 400) searchIntentMatch += 12;
    else if (signals.wordCount >= 150) searchIntentMatch += 6;
    if (signals.headings.h2 >= 2) searchIntentMatch += 10;
  } else if (intent === "commercial") {
    searchIntentMatch = 35;
    if (/比較|料金|価格|おすすめ|ランキング|メリット|デメリット/.test(body))
      searchIntentMatch += 20;
    if (signals.headings.h2 >= 3) searchIntentMatch += 12;
    if (examples) searchIntentMatch += 12;
    if (signals.hasCitationMarkers) searchIntentMatch += 8;
    if (signals.schema.hasOrganization) searchIntentMatch += 8;
  } else if (intent === "navigational") {
    searchIntentMatch = 40;
    if (locations.title || locations.h1) searchIntentMatch += 25;
    if (signals.canonical) searchIntentMatch += 10;
    if (signals.schema.hasOrganization || signals.schema.hasWebSite)
      searchIntentMatch += 15;
  } else {
    searchIntentMatch = 45;
    if (signals.wordCount >= 200) searchIntentMatch += 15;
    if (signals.headings.h2 >= 2) searchIntentMatch += 15;
    if (signals.jsonLdCount > 0) searchIntentMatch += 10;
  }
  if (keyword && keywordRelevance >= 60) searchIntentMatch += 8;
  searchIntentMatch = clamp(searchIntentMatch);

  // --- Score: 回答カバー率 ---
  let answerCoverage = 0;
  answerCoverage += definition ? 22 : 0;
  answerCoverage += signals.hasFaqLikeStructure ? 16 : 0;
  answerCoverage += signals.schema.hasFaqPage ? 12 : 0;
  answerCoverage += signals.schema.hasHowTo ? 12 : 0;
  answerCoverage += examples ? 14 : 0;
  answerCoverage += signals.hasCitationMarkers ? 10 : 0;
  if (signals.wordCount >= 600) answerCoverage += 14;
  else if (signals.wordCount >= 300) answerCoverage += 10;
  else if (signals.wordCount >= 120) answerCoverage += 5;
  // question-like headings as extractable answers
  const qHeadings = signals.headingTexts.filter((h) =>
    /[？?]$|^(Q[\d\.\:：\s]|質問)/i.test(h.text.trim())
  ).length;
  answerCoverage += Math.min(qHeadings, 3) * 4;
  if (keyword && locations.body && keywordRelevance >= 50) answerCoverage += 6;
  answerCoverage = clamp(answerCoverage);

  // --- Question details + 質問カバー率 ---
  const questionDetails: QuestionCoverage[] = questions.map((question) => {
    const qTokens = questionTokens(question);
    const bodyRatio = tokenHitRatio(body, qTokens);
    const headRatio = tokenHitRatio(allHeadings, qTokens);
    const titleRatio = tokenHitRatio(`${title} ${desc}`, qTokens);
    const combined = bodyRatio * 0.55 + headRatio * 0.3 + titleRatio * 0.15;

    const qCore = normalizeText(question).replace(/[？?]/g, "").slice(0, 24);
    const headingMatch =
      qCore.length >= 4 &&
      signals.headingTexts.some((h) =>
        normalizeText(h.text).includes(
          qCore.slice(0, Math.min(16, qCore.length))
        )
      );

    const score = clamp(
      combined * 100 +
        (headingMatch ? 15 : 0) +
        (signals.hasFaqLikeStructure ? 5 : 0) +
        (signals.schema.hasFaqPage ? 5 : 0)
    );
    const covered = score >= 45 || headingMatch;

    let evidence: string | null = null;
    if (headingMatch) {
      const hit = signals.headingTexts.find((h) =>
        normalizeText(h.text).includes(
          qCore.slice(0, Math.min(12, qCore.length))
        )
      );
      if (hit) evidence = `見出し: ${hit.text}`;
    } else if (bodyRatio >= 0.4) {
      evidence = "本文に質問の主要語が複数含まれます";
    } else if (qTokens.length > 0) {
      const missing = qTokens.filter((t) => !normalizeText(body).includes(t));
      if (missing.length)
        evidence = `不足しそうな語: ${missing.slice(0, 4).join("、")}`;
    }

    return { question, covered, score, evidence };
  });

  let questionCoverageScore: number;
  if (questionDetails.length > 0) {
    questionCoverageScore = clamp(
      questionDetails.reduce((s, q) => s + q.score, 0) /
        questionDetails.length
    );
  } else if (hasKeyword) {
    // Proxy: can the page answer likely queries around the keyword?
    questionCoverageScore = clamp(
      (signals.hasFaqLikeStructure ? 28 : 8) +
        (signals.schema.hasFaqPage ? 18 : 0) +
        (qHeadings >= 2 ? 20 : qHeadings === 1 ? 10 : 0) +
        (definition ? 15 : 0) +
        (signals.wordCount >= 400 ? 15 : 5) +
        (locations.h2h3 ? 10 : 0)
    );
  } else {
    questionCoverageScore = clamp(
      (signals.hasFaqLikeStructure ? 30 : 10) +
        (signals.schema.hasFaqPage ? 20 : 0) +
        Math.min(qHeadings, 3) * 10 +
        (signals.wordCount >= 300 ? 15 : 0)
    );
  }

  // --- Score: トピック網羅性 ---
  let topicCoverage = 0;
  const h2 = signals.headings.h2;
  const h3 = signals.headings.h3;
  topicCoverage += Math.min(h2, 5) * 8; // up to 40
  topicCoverage += Math.min(h3, 4) * 4; // up to 16
  if (keyword && tokens.length > 0) {
    const relatedHeads = signals.headingTexts.filter(
      (h) =>
        h.level >= 2 &&
        h.level <= 3 &&
        tokenHitRatio(h.text, tokens) >= 0.34
    ).length;
    topicCoverage += Math.min(relatedHeads, 4) * 6;
  }
  topicCoverage += signals.jsonLdCount > 0 ? 10 : 0;
  topicCoverage += signals.schema.types.length >= 2 ? 6 : 0;
  topicCoverage += signals.hasCitationMarkers ? 8 : 0;
  topicCoverage += examples ? 8 : 0;
  if (signals.wordCount >= 800) topicCoverage += 10;
  else if (signals.wordCount >= 400) topicCoverage += 6;
  topicCoverage = clamp(topicCoverage);

  // --- Query Visibility Score (keyword only) ---
  let queryVisibilityScore: number | null = null;
  if (hasKeyword) {
    queryVisibilityScore = clamp(
      keywordRelevance * 0.28 +
        searchIntentMatch * 0.18 +
        answerCoverage * 0.2 +
        questionCoverageScore * 0.16 +
        topicCoverage * 0.18
    );
  }

  const scores: KeywordScores = {
    keywordRelevance,
    searchIntentMatch,
    answerCoverage,
    questionCoverage: questionCoverageScore,
    topicCoverage,
    queryVisibilityScore,
  };

  // --- Match signals (evaluation targets) ---
  const matchSignals: KeywordMatchSignal[] = [
    {
      id: "title",
      label: "title",
      matched: hasKeyword ? locations.title : Boolean(signals.title),
      detail: hasKeyword
        ? locations.title
          ? "キーワードが title に含まれます"
          : "title にキーワードがありません"
        : signals.title
          ? "title あり"
          : "title なし",
    },
    {
      id: "description",
      label: "description",
      matched: hasKeyword
        ? locations.metaDescription
        : Boolean(signals.metaDescription),
      detail: hasKeyword
        ? locations.metaDescription
          ? "キーワードが meta description に含まれます"
          : "description にキーワードがありません"
        : signals.metaDescription
          ? "description あり"
          : "description なし",
    },
    {
      id: "h1",
      label: "H1",
      matched: hasKeyword
        ? locations.h1
        : signals.headings.h1 === 1,
      detail: hasKeyword
        ? locations.h1
          ? "H1 にキーワードあり"
          : "H1 にキーワードなし"
        : `H1: ${signals.headings.h1} 件`,
    },
    {
      id: "h2h3",
      label: "H2–H3",
      matched: hasKeyword
        ? locations.h2h3
        : signals.headings.h2 + signals.headings.h3 > 0,
      detail: hasKeyword
        ? locations.h2h3
          ? "H2/H3 にキーワードあり"
          : "H2/H3 にキーワードなし"
        : `H2:${signals.headings.h2} / H3:${signals.headings.h3}`,
    },
    {
      id: "body",
      label: "本文",
      matched: hasKeyword
        ? locations.body
        : signals.wordCount >= 150,
      detail: hasKeyword
        ? locations.body
          ? `本文に出現（推定 ${occurrenceEstimate} 回）`
          : "本文にキーワードなし"
        : `本文量 約 ${signals.wordCount} 語`,
    },
    {
      id: "faq",
      label: "FAQ / Q&A",
      matched: locations.faq,
      detail: locations.faq
        ? "FAQ 的構造または FAQ Schema あり"
        : "FAQ / Q&A 構造が弱い",
    },
    {
      id: "jsonld",
      label: "JSON-LD",
      matched: locations.jsonLd,
      detail: locations.jsonLd
        ? `構造化データ ${signals.jsonLdCount} 件`
        : "JSON-LD なし",
    },
    {
      id: "citations",
      label: "出典",
      matched: locations.citations,
      detail: locations.citations
        ? "出典・引用マーカーあり"
        : "出典表記が見つかりません",
    },
    {
      id: "examples",
      label: "具体例",
      matched: locations.examples,
      detail: locations.examples
        ? "具体例・数値などの具体情報あり"
        : "具体例・数値が少ない可能性",
    },
  ];

  const missingItems: string[] = [];
  for (const s of matchSignals) {
    if (!s.matched) {
      if (hasKeyword) {
        if (s.id === "title")
          missingItems.push("title にキーワードを含める");
        else if (s.id === "description")
          missingItems.push("meta description にキーワードを含める");
        else if (s.id === "h1") missingItems.push("H1 にキーワードを反映");
        else if (s.id === "h2h3")
          missingItems.push("H2/H3 でキーワード関連トピックを展開");
        else if (s.id === "body")
          missingItems.push("本文でキーワードと関連語を自然に使う");
        else if (s.id === "faq")
          missingItems.push("FAQ / Q&A セクションを追加");
        else if (s.id === "jsonld")
          missingItems.push("JSON-LD 構造化データを実装");
        else if (s.id === "citations")
          missingItems.push("出典・参考文献を明示");
        else if (s.id === "examples")
          missingItems.push("具体例・数値・事例を追加");
      } else {
        missingItems.push(s.detail);
      }
    }
  }
  for (const q of questionDetails) {
    if (!q.covered) {
      missingItems.push(`想定質問への回答: 「${q.question}」`);
    }
  }

  // Summary
  let summary: string;
  const noKeywordNotice = hasKeyword
    ? null
    : "キーワード未入力のため、サイト構造のみ分析しています";

  if (!hasKeyword) {
    summary =
      questions.length > 0
        ? `キーワード未入力のためサイト構造を分析しました。AI想定質問 ${questions.length} 件のカバー率は ${questionCoverageScore}/100 です。`
        : "キーワード未入力のため、サイト構造のみ分析しています。";
  } else {
    const places = matchSignals
      .filter((s) => s.matched && ["title", "description", "h1", "h2h3", "body"].includes(s.id))
      .map((s) => s.label);
    summary =
      places.length > 0
        ? `「${keyword}」は ${places.join("・")} に一致。Query Visibility ${queryVisibilityScore}/100。`
        : `「${keyword}」の明示的な出現が少なく、Query Visibility は ${queryVisibilityScore}/100 です。`;
  }

  return {
    keyword,
    questions,
    hasKeyword,
    scores,
    locations,
    matchSignals,
    missingItems: missingItems.slice(0, 12),
    occurrenceEstimate,
    questionDetails,
    summary,
    noKeywordNotice,
  };
}

const EFFECT_SUFFIX =
  "（ルールベース推定。Google 等の順位や ChatGPT 等の実際の引用を保証するものではありません）";

function effect(text: string): string {
  return `${text}${EFFECT_SUFFIX}`;
}

/**
 * Keyword-linked issues. Emitted when a main keyword and/or AI questions were provided.
 */
export function keywordIssues(
  analysis: KeywordAnalysis | null
): import("./types").Issue[] {
  if (!analysis) return [];
  // No keyword and no questions → no keyword-linked issues
  if (!analysis.hasKeyword && analysis.questionDetails.length === 0) {
    return [];
  }

  const issues: import("./types").Issue[] = [];
  const kw = analysis.keyword || "";

  if (analysis.hasKeyword) {
    if (!analysis.locations.title) {
      issues.push({
        id: "kw-title",
        severity: "High",
        title: "キーワードがタイトルにありません",
        description: `メインキーワード「${kw}」が title に見つかりません。主題を title に自然に含めると、HTML シグナル上のキーワード関連性が上がります。`,
        category: "SEO",
      });
    }

    if (!analysis.locations.h1) {
      issues.push({
        id: "kw-h1",
        severity: "High",
        title: "H1に検索テーマがありません",
        description: `H1 に「${kw}」に相当する検索テーマが見つかりません。ページの主題を H1 で明示してください。`,
        category: "SEO",
      });
    }

    if (!analysis.locations.metaDescription) {
      issues.push({
        id: "kw-desc",
        severity: "Medium",
        title: "メタディスクリプションにキーワードがありません",
        description: `description に「${kw}」が含まれていません。スニペット候補として要約文へ自然に入れることを推奨します。`,
        category: "SEO",
      });
    }

    if (!analysis.locations.h2h3) {
      issues.push({
        id: "kw-h2h3",
        severity: "Medium",
        title: "H2/H3に検索テーマの展開がありません",
        description:
          "H2–H3 にキーワードや関連トピックが見つかりません。セクション見出しで論点を分割してください。",
        category: "SEO",
      });
    }

    // 関連語: low relevance / sparse body despite keyword intent
    if (
      analysis.scores.keywordRelevance < 55 ||
      analysis.scores.topicCoverage < 45 ||
      (!analysis.locations.body && analysis.occurrenceEstimate === 0)
    ) {
      issues.push({
        id: "kw-related-terms",
        severity:
          analysis.scores.keywordRelevance < 35 ? "High" : "Medium",
        title: "関連語が不足しています",
        description: `「${kw}」周辺の同義語・具体語・比較軸が本文・見出しに少なく、トピック網羅性が弱い状態です（ルールベース推定）。`,
        category: "SEO",
      });
    }

  }

  // FAQ / Q&A — when keyword or questions context exists
  if (!analysis.locations.faq) {
    issues.push({
      id: "kw-faq",
      severity: "Medium",
      title: "FAQ/Q&A構造がありません",
      description:
        "FAQ 的な見出しや FAQPage Schema が見つかりません。想定質問がある場合は Q&A ブロックの追加を検討してください。",
      category: "AEO",
    });
  }

  // Direct answers to user questions (or general answer weakness)
  const uncovered = analysis.questionDetails.filter((q) => !q.covered);
  if (uncovered.length > 0) {
    issues.push({
      id: "kw-questions-uncovered",
      severity: "High",
      title: "質問への直接回答が不足しています",
      description: uncovered
        .map((q) => `「${q.question}」`)
        .join("、")
        .concat(
          " に対する明確な回答（見出し＋簡潔な答え）がページ上で弱いと推定されます。"
        ),
      category: "AEO",
    });
  } else if (analysis.hasKeyword && analysis.scores.answerCoverage < 50) {
    issues.push({
      id: "kw-direct-answer",
      severity: "High",
      title: "質問への直接回答が不足しています",
      description:
        "定義・要点・手順など、クエリに対する直接回答ブロックが弱いと推定されます。導入部に2〜4文の明確な答えを置くことを推奨します。",
      category: "AEO",
    });
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return issues.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

/**
 * Keyword-linked recommendations with rule-based predicted effects.
 * Never claim real Google rankings or ChatGPT/Gemini citation rates.
 */
export function keywordRecommendations(
  analysis: KeywordAnalysis | null
): import("./types").Recommendation[] {
  if (!analysis) return [];
  if (!analysis.hasKeyword && analysis.questionDetails.length === 0) {
    return [];
  }

  const recs: import("./types").Recommendation[] = [];
  const kw = analysis.keyword || "";

  if (analysis.hasKeyword && !analysis.locations.title) {
    recs.push({
      id: "rec-kw-title",
      title: "タイトルにキーワードを自然に含める",
      description: `title に「${kw}」を無理なく含め、誰向けの何のページかが伝わる 30〜60 文字前後に整えます。`,
      predictedEffect: effect(
        "キーワード関連性が約 +8〜15 点、Query Visibility も改善する見込みです"
      ),
      impactPoints: 8,
      target: "SEO",
    });
  }

  if (analysis.hasKeyword && !analysis.locations.h1) {
    recs.push({
      id: "rec-kw-h1",
      title: "H1に検索テーマを明示する",
      description: `単一の H1 で「${kw}」に対応する検索テーマを示し、詳細は H2 以降へ分割します。`,
      predictedEffect: effect(
        "検索意図一致度とキーワード関連性が改善する見込みです"
      ),
      impactPoints: 7,
      target: "SEO",
    });
  }

  if (
    analysis.hasKeyword &&
    (analysis.scores.keywordRelevance < 55 ||
      analysis.scores.topicCoverage < 45)
  ) {
    recs.push({
      id: "rec-kw-related",
      title: "関連語・周辺トピックを見出しと本文に追加する",
      description: `「${kw}」の同義語、比較軸、具体例、数値を H2/H3 と段落に分散して書き、トピックの厚みを出します（キーワードの過剰繰り返しは避けます）。`,
      predictedEffect: effect(
        "関連語不足が解消され、トピック網羅性が約 +10 点前後向上する見込みです"
      ),
      impactPoints: 7,
      target: "SEO",
    });
  }

  if (
    analysis.scores.answerCoverage < 55 ||
    analysis.questionDetails.some((q) => !q.covered)
  ) {
    recs.push({
      id: "rec-kw-direct-answer",
      title: "想定クエリへの直接回答を冒頭に書く",
      description:
        "「結論 → 理由 → 具体例」の順で 2〜4 文の直接回答を置き、必要なら箇条書きで補足します。",
      predictedEffect: effect(
        "回答カバー率が改善し、AEO 向けの抜粋しやすさが上がる見込みです"
      ),
      impactPoints: 8,
      target: "AEO",
    });
  }

  if (!analysis.locations.faq) {
    recs.push({
      id: "rec-kw-faq",
      title: "FAQ/Q&A構造を追加する",
      description:
        "想定質問を 3 件程度用意し、質問見出し＋短い回答を配置します。可能なら FAQPage の JSON-LD も付与します。",
      predictedEffect: effect(
        "質問カバー率と回答カバー率が改善する見込みです"
      ),
      impactPoints: 7,
      target: "AEO",
    });
  }

  const uncovered = analysis.questionDetails.filter((q) => !q.covered);
  if (uncovered.length > 0) {
    recs.push({
      id: "rec-kw-questions",
      title: "入力したAI想定質問に1対1で答える",
      description: uncovered
        .map((q) => `「${q.question}」`)
        .join("、")
        .concat(
          " それぞれに専用の見出しと直接回答段落を用意してください。"
        ),
      predictedEffect: effect(
        `質問カバー率が最大で約 ${Math.min(uncovered.length * 12, 30)} 点相当改善する見込みです`
      ),
      impactPoints: 8,
      target: "AEO",
    });
  }

  if (
    analysis.hasKeyword &&
    analysis.scores.queryVisibilityScore !== null &&
    analysis.scores.queryVisibilityScore < 60
  ) {
    recs.push({
      id: "rec-kw-qvs",
      title: "Query Visibility を底上げする総合改善",
      description: `title・H1・導入回答・FAQ・関連語をセットで整え、「${kw}」に対するページの一貫した答えを作ります。`,
      predictedEffect: effect(
        "Query Visibility Score が総合的に改善する見込みです"
      ),
      impactPoints: 9,
      target: "Overall",
    });
  }

  // Prefer higher impact, cap list
  return recs
    .sort((a, b) => b.impactPoints - a.impactPoints)
    .slice(0, 6);
}
