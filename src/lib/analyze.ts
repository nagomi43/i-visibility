import { AnalyzeError } from "./errors";
import { fetchPageHtml, probePathExists } from "./fetch-html";
import { parseHtmlSignals } from "./parse-html";
import { buildAnalysisResult } from "./score";
import type { AnalysisResult } from "./types";

export async function analyzeUrl(rawUrl: string): Promise<AnalysisResult> {
  const page = await fetchPageHtml(rawUrl);
  const origin = new URL(page.finalUrl).origin;

  const [hasLlmsTxt, hasRobotsTxt, hasSitemap] = await Promise.all([
    probePathExists(origin, "/llms.txt"),
    probePathExists(origin, "/robots.txt"),
    probePathExists(origin, "/sitemap.xml"),
  ]);

  try {
    const signals = parseHtmlSignals(page.html, page.finalUrl, {
      hasLlmsTxt,
      hasRobotsTxt,
      hasSitemap,
    });
    return buildAnalysisResult(page.finalUrl, signals, "live");
  } catch (e) {
    if (e instanceof AnalyzeError) throw e;
    throw new AnalyzeError(
      "HTMLの解析中にエラーが発生しました。ページ構造を確認するか、デモモードをお試しください。",
      "PARSE_ERROR"
    );
  }
}
