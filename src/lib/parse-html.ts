import * as cheerio from "cheerio";
import type { AnalysisSignals, HeadingCounts, SchemaPresence } from "./types";

function textLength(s: string | null | undefined): number {
  return (s || "").trim().length;
}

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function collectJsonLd($: cheerio.CheerioAPI): unknown[] {
  const items: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items.push(...parsed);
      else items.push(parsed);
    } catch {
      // ignore invalid JSON-LD
    }
  });
  return items;
}

function extractSchemaTypes(nodes: unknown[]): string[] {
  const types = new Set<string>();

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") types.add(t);
    else if (Array.isArray(t)) {
      t.forEach((x) => {
        if (typeof x === "string") types.add(x);
      });
    }
    if (obj["@graph"]) walk(obj["@graph"]);
    // shallow recurse common nesting
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") walk(v);
    }
  };

  nodes.forEach(walk);
  return Array.from(types).sort();
}

function buildSchemaPresence(types: string[], rawCount: number): SchemaPresence {
  const has = (name: string) =>
    types.some((t) => t.toLowerCase() === name.toLowerCase());

  return {
    types,
    hasFaqPage: has("FAQPage"),
    hasHowTo: has("HowTo"),
    hasOrganization: has("Organization"),
    hasPerson: has("Person"),
    hasBreadcrumbList: has("BreadcrumbList"),
    hasArticle: has("Article") || has("NewsArticle") || has("BlogPosting"),
    hasWebSite: has("WebSite"),
    rawCount,
  };
}

function detectAuthor(
  $: cheerio.CheerioAPI,
  schemaTypes: string[],
  jsonLd: unknown[]
): { hasAuthor: boolean; authorText: string | null } {
  const metaAuthor =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    null;

  let schemaAuthor: string | null = null;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj.author) {
      if (typeof obj.author === "string") schemaAuthor = obj.author;
      else if (typeof obj.author === "object" && obj.author !== null) {
        const a = obj.author as Record<string, unknown>;
        if (typeof a.name === "string") schemaAuthor = a.name;
      }
    }
    if (obj["@graph"]) walk(obj["@graph"]);
  };
  jsonLd.forEach(walk);

  const relAuthor = $('a[rel="author"]').first().text();
  const itemprop = $('[itemprop="author"]').first().text();

  const candidates = [
    metaAuthor,
    schemaAuthor,
    relAuthor ? normalizeSpace(relAuthor) : null,
    itemprop ? normalizeSpace(itemprop) : null,
  ].filter(Boolean) as string[];

  const hasPerson = schemaTypes.some((t) => t.toLowerCase() === "person");
  const authorText = candidates[0] || null;
  return {
    hasAuthor: Boolean(authorText) || hasPerson,
    authorText,
  };
}

function countWords(text: string): number {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return 0;
  // Support CJK roughly: count latin words + CJK chars groups
  const latin = cleaned.match(/[A-Za-z0-9]+/g)?.length || 0;
  const cjk = cleaned.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]+/g);
  const cjkUnits = cjk
    ? cjk.reduce((sum, s) => sum + Math.ceil(s.length / 2), 0)
    : 0;
  return Math.max(latin + cjkUnits, cleaned.length > 0 ? 1 : 0);
}

function detectFaqLike($: cheerio.CheerioAPI, bodyText: string): boolean {
  const faqKeywords = /faq|よくある質問|Q&A|Ｑ＆Ａ|質問と回答/i;
  if (faqKeywords.test(bodyText.slice(0, 5000))) return true;
  if ($('[itemtype*="FAQPage"]').length > 0) return true;
  // dt/dd pairs or details/summary
  if ($("details summary").length >= 2) return true;
  if ($("dl dt").length >= 2) return true;
  // headings that look like questions
  let qHeadings = 0;
  $("h2, h3").each((_, el) => {
    const t = $(el).text();
    if (/[？?]$/.test(t.trim()) || /^(Q[\d\.\:：\s]|質問)/i.test(t.trim())) {
      qHeadings += 1;
    }
  });
  return qHeadings >= 2;
}

function detectCitations(bodyText: string, $: cheerio.CheerioAPI): boolean {
  const patterns =
    /出典|引用|参考文献|参考資料|Source:|References|Cite|doi:|ISBN/i;
  if (patterns.test(bodyText)) return true;
  if ($("blockquote cite, cite, .citation, .references, #references").length > 0)
    return true;
  if ($('a[href*="doi.org"]').length > 0) return true;
  return false;
}

function isInternalHref(href: string, pageUrl: string): boolean | null {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
    return null;
  }
  try {
    const base = new URL(pageUrl);
    const abs = new URL(href, base);
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
    return abs.hostname === base.hostname;
  } catch {
    return null;
  }
}

export function parseHtmlSignals(
  html: string,
  pageUrl: string,
  extras?: {
    hasLlmsTxt: boolean;
    hasRobotsTxt: boolean;
    hasSitemap: boolean;
  }
): AnalysisSignals {
  const $ = cheerio.load(html);

  // Remove script/style noise for body text
  const $clone = cheerio.load(html);
  $clone("script, style, noscript, svg").remove();
  const bodyText = normalizeSpace($clone("body").text() || $clone.root().text());

  const title = normalizeSpace($("title").first().text()) || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;

  const headings: HeadingCounts = {
    h1: $("h1").length,
    h2: $("h2").length,
    h3: $("h3").length,
    h4: $("h4").length,
    h5: $("h5").length,
    h6: $("h6").length,
  };

  const headingTexts: { level: number; text: string }[] = [];
  for (let level = 1; level <= 6; level++) {
    $(`h${level}`).each((_, el) => {
      const text = normalizeSpace($(el).text());
      if (text) headingTexts.push({ level, text: text.slice(0, 120) });
    });
  }

  let internalLinks = 0;
  let externalLinks = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const kind = isInternalHref(href, pageUrl);
    if (kind === true) internalLinks += 1;
    else if (kind === false) externalLinks += 1;
  });

  let imagesTotal = 0;
  let imagesWithAlt = 0;
  $("img").each((_, el) => {
    imagesTotal += 1;
    const alt = $(el).attr("alt");
    if (typeof alt === "string" && alt.trim().length > 0) imagesWithAlt += 1;
  });

  const canonical =
    $('link[rel="canonical"]').attr("href")?.trim() ||
    $('meta[property="og:url"]').attr("content")?.trim() ||
    null;

  const robotsMeta =
    $('meta[name="robots"]').attr("content")?.trim() ||
    $('meta[name="googlebot"]').attr("content")?.trim() ||
    null;

  const jsonLd = collectJsonLd($);
  const schemaTypes = extractSchemaTypes(jsonLd);
  const schema = buildSchemaPresence(schemaTypes, jsonLd.length);
  const author = detectAuthor($, schemaTypes, jsonLd);

  const openGraph = {
    title: Boolean($('meta[property="og:title"]').attr("content")),
    description: Boolean($('meta[property="og:description"]').attr("content")),
    image: Boolean($('meta[property="og:image"]').attr("content")),
    url: Boolean($('meta[property="og:url"]').attr("content")),
    type: Boolean($('meta[property="og:type"]').attr("content")),
  };

  const twitterCard = {
    card: Boolean(
      $('meta[name="twitter:card"]').attr("content") ||
        $('meta[property="twitter:card"]').attr("content")
    ),
    title: Boolean(
      $('meta[name="twitter:title"]').attr("content") ||
        $('meta[property="twitter:title"]').attr("content")
    ),
    description: Boolean(
      $('meta[name="twitter:description"]').attr("content") ||
        $('meta[property="twitter:description"]').attr("content")
    ),
    image: Boolean(
      $('meta[name="twitter:image"]').attr("content") ||
        $('meta[property="twitter:image"]').attr("content")
    ),
  };

  const contentLanguage =
    $("html").attr("lang")?.trim() ||
    $('meta[http-equiv="content-language"]').attr("content")?.trim() ||
    null;

  return {
    title,
    titleLength: textLength(title),
    metaDescription,
    metaDescriptionLength: textLength(metaDescription),
    headings,
    headingTexts: headingTexts.slice(0, 40),
    internalLinks,
    externalLinks,
    imagesTotal,
    imagesWithAlt,
    imagesMissingAlt: Math.max(0, imagesTotal - imagesWithAlt),
    canonical,
    robotsMeta,
    jsonLdCount: jsonLd.length,
    schema,
    hasAuthor: author.hasAuthor,
    authorText: author.authorText,
    openGraph,
    twitterCard,
    wordCount: countWords(bodyText),
    hasFaqLikeStructure: detectFaqLike($, bodyText) || schema.hasFaqPage,
    hasCitationMarkers: detectCitations(bodyText, $),
    hasLlmsTxt: extras?.hasLlmsTxt ?? false,
    hasRobotsTxt: extras?.hasRobotsTxt ?? false,
    hasSitemap: extras?.hasSitemap ?? false,
    contentLanguage,
  };
}
