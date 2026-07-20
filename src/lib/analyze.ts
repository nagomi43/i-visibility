import { AnalyzeError } from "./errors";
import { fetchPageHtml, probePathExists } from "./fetch-html";
import type { KeywordAnalysisInput } from "./keyword-analysis";
import { parseHtmlSignals } from "./parse-html";
import { buildAnalysisResult } from "./score";
import type { AnalysisResult } from "./types";

export async function analyzeUrl(
  rawUrl: string,
  keywordInput?: KeywordAnalysisInput | null
): Promise<AnalysisResult> {
  const page = await fetchPageHtml(rawUrl);
  const origin = new URL(page.finalUrl).origin;

  const [hasLlmsTxt, hasRobotsTxt, hasSitemap] = await Promise.all([
    probePathExists(origin, "/llms.txt"),
    probePathExists(origin, "/robots.txt"),
    probePathExists(origin, "/sitemap.xml"),
  ]);

  try {
    const { signals, bodyText } = parseHtmlSignals(page.html, page.finalUrl, {
      hasLlmsTxt,
      hasRobotsTxt,
      hasSitemap,
    });
    return buildAnalysisResult(page.finalUrl, signals, "live", {
      bodyText,
      keywordInput,
    });
  } catch (e) {
    if (e instanceof AnalyzeError) throw e;
    throw new AnalyzeError(
      "HTMLの解析中にエラーが発生しました。ページ構造を確認するか、デモモードをお試しください。",
      "PARSE_ERROR"
    );
  }
}
