import { AnalyzeError, classifyNetworkError } from "./errors";
import { validatePublicHttpUrl } from "./ssrf";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 2_000_000; // 2MB
const MAX_PROBE_BYTES = 64_000;
const MAX_REDIRECTS = 5;

const DEFAULT_HEADERS: HeadersInit = {
  "User-Agent":
    "AIVisibilityScoreBot/0.1 (+https://localhost; read-only analysis MVP)",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ja,en;q=0.8",
};

export type FetchedPage = {
  url: string;
  finalUrl: string;
  html: string;
  status: number;
};

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * Fetch with redirect: "manual". Each hop is validated via SSRF checks
 * before the next request is issued (max 5 redirects).
 */
async function fetchWithSafeRedirects(
  startUrl: string,
  options: {
    signal: AbortSignal;
    headers: HeadersInit;
    acceptNonHtml?: boolean;
  }
): Promise<{ res: Response; finalUrl: string }> {
  let currentHref = startUrl;
  let redirects = 0;

  while (true) {
    // Validate every hop before connecting
    const validated = await validatePublicHttpUrl(currentHref);

    let res: Response;
    try {
      res = await fetch(validated.href, {
        method: "GET",
        redirect: "manual",
        signal: options.signal,
        headers: options.headers,
        cache: "no-store",
      });
    } catch (e) {
      throw classifyNetworkError(e);
    }

    if (isRedirectStatus(res.status)) {
      const location = res.headers.get("location");
      if (!location) {
        throw new AnalyzeError(
          `リダイレクト先が不明です（HTTP ${res.status}）。URLを確認してください。`,
          "HTTP_ERROR"
        );
      }

      redirects += 1;
      if (redirects > MAX_REDIRECTS) {
        throw new AnalyzeError(
          `リダイレクトが${MAX_REDIRECTS}回を超えたため中止しました。安全のため解析を停止します。`,
          "REDIRECT_LIMIT"
        );
      }

      // Resolve relative Location against the current hop
      let nextHref: string;
      try {
        nextHref = new URL(location, validated.href).href;
      } catch {
        throw new AnalyzeError(
          "リダイレクト先のURLが不正です。",
          "INVALID_URL"
        );
      }

      // Next loop will re-validate before fetch
      currentHref = nextHref;
      continue;
    }

    return { res, finalUrl: validated.href };
  }
}

async function readResponseBytes(
  res: Response,
  maxBytes: number,
  tooLargeMessage: string
): Promise<ArrayBuffer> {
  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength > maxBytes) {
    throw new AnalyzeError(tooLargeMessage, "PAYLOAD_TOO_LARGE");
  }

  const reader = res.body?.getReader();
  if (!reader) {
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new AnalyzeError(tooLargeMessage, "PAYLOAD_TOO_LARGE");
    }
    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new AnalyzeError(tooLargeMessage, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

async function readResponseText(
  res: Response,
  maxBytes: number
): Promise<string> {
  const buffer = await readResponseBytes(
    res,
    maxBytes,
    "対象ファイルが大きすぎるため、安全のため読み込みを中止しました。"
  );
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

export async function fetchPageHtml(rawUrl: string): Promise<FetchedPage> {
  const initial = await validatePublicHttpUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const { res, finalUrl } = await fetchWithSafeRedirects(initial.href, {
      signal: controller.signal,
      headers: DEFAULT_HEADERS,
    });

    if (!res.ok) {
      throw new AnalyzeError(
        `ページの取得に失敗しました（HTTP ${res.status}）。URLを確認するか、デモモードをお試しください。`,
        "HTTP_ERROR"
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml") &&
      !contentType.includes("text/plain")
    ) {
      throw new AnalyzeError(
        `HTML以外のコンテンツ（${contentType.split(";")[0].trim()}）が返されました。WebページのURLを指定してください。`,
        "NOT_HTML"
      );
    }

    let html: string;
    try {
      const buf = await readResponseBytes(
        res,
        MAX_HTML_BYTES,
        "HTMLが大きすぎるため、安全のため解析を中止しました（上限2MB）。"
      );
      html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    } catch (e) {
      throw classifyNetworkError(e);
    }

    return {
      url: initial.href,
      finalUrl,
      html,
      status: res.status,
    };
  } catch (e) {
    if (e instanceof AnalyzeError) throw e;
    throw classifyNetworkError(e);
  } finally {
    clearTimeout(timer);
  }
}

export async function probePathExists(
  origin: string,
  path: string
): Promise<boolean> {
  try {
    const target = new URL(path, origin).href;
    // Initial validation before any request
    await validatePublicHttpUrl(target);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    try {
      const { res } = await fetchWithSafeRedirects(target, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "AIVisibilityScoreBot/0.1 (+https://localhost; read-only analysis MVP)",
          Accept: "text/plain,text/*,*/*;q=0.1",
        },
      });

      if (!res.ok) return false;

      const ct = res.headers.get("content-type") || "";
      if (path.endsWith(".txt") && ct.includes("text/html")) {
        const text = (await readResponseText(res, MAX_PROBE_BYTES)).slice(0, 500);
        if (
          /<!doctype html|<html/i.test(text) &&
          !/llms|user-agent|sitemap/i.test(text)
        ) {
          return false;
        }
        return text.trim().length > 0;
      }
      if (path.includes("sitemap") && ct.includes("text/html")) {
        const text = (await readResponseText(res, MAX_PROBE_BYTES)).slice(0, 400);
        if (
          /<!doctype html|<html/i.test(text) &&
          !/<urlset|<sitemapindex/i.test(text)
        ) {
          return false;
        }
        return true;
      }
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}
