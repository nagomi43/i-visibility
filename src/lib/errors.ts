/**
 * Structured analysis / fetch errors with Japanese user-facing messages.
 * Never surface raw engine strings like "fetch failed" or UND_ERR_*.
 */

export type AnalyzeErrorCode =
  | "DNS_FAILED"
  | "CONNECT_TIMEOUT"
  | "FETCH_TIMEOUT"
  | "HTTP_ERROR"
  | "NOT_HTML"
  | "PARSE_ERROR"
  | "SSRF_BLOCKED"
  | "REDIRECT_LIMIT"
  | "INVALID_URL"
  | "MISSING_URL"
  | "UNKNOWN";

export class AnalyzeError extends Error {
  readonly code: AnalyzeErrorCode;

  constructor(message: string, code: AnalyzeErrorCode) {
    super(message);
    this.name = "AnalyzeError";
    this.code = code;
  }
}

type LooseError = Error & {
  code?: string | number;
  errno?: string | number;
  cause?: unknown;
  errors?: unknown[];
};

function collectErrorNodes(err: unknown, depth = 0): LooseError[] {
  if (depth > 10 || err == null) return [];
  if (!(err instanceof Error) && typeof err !== "object") return [];

  const node = err as LooseError;
  const list: LooseError[] = [node];

  if (node.cause != null) {
    list.push(...collectErrorNodes(node.cause, depth + 1));
  }
  if (Array.isArray(node.errors)) {
    for (const sub of node.errors) {
      list.push(...collectErrorNodes(sub, depth + 1));
    }
  }
  return list;
}

function blobFromErrors(nodes: LooseError[]): string {
  return nodes
    .map((n) => {
      const parts = [
        n.name,
        n.message,
        n.code != null ? String(n.code) : "",
        n.errno != null ? String(n.errno) : "",
      ];
      return parts.filter(Boolean).join(" ");
    })
    .join(" | ")
    .toLowerCase();
}

/** Map low-level fetch/network failures to Japanese AnalyzeError. */
export function classifyNetworkError(err: unknown): AnalyzeError {
  if (err instanceof AnalyzeError) return err;

  const nodes = collectErrorNodes(err);
  const blob = blobFromErrors(nodes);
  const top = err instanceof Error ? err : null;

  // Our abort (overall 12s budget)
  if (
    top?.name === "AbortError" ||
    blob.includes("aborterror") ||
    blob.includes("this operation was aborted") ||
    blob.includes("the operation was aborted")
  ) {
    return new AnalyzeError(
      "ページの取得がタイムアウトしました（12秒）。ネットワーク状況を確認するか、デモモードをお試しください。",
      "FETCH_TIMEOUT"
    );
  }

  // Connection timeout (undici ConnectTimeoutError / UND_ERR_CONNECT_TIMEOUT)
  if (
    blob.includes("und_err_connect_timeout") ||
    blob.includes("connecttimeout") ||
    blob.includes("connect timeout") ||
    blob.includes("connection timed out") ||
    (blob.includes("etimedout") && blob.includes("connect"))
  ) {
    return new AnalyzeError(
      "対象サイトへの接続がタイムアウトしました。サイトが応答していないか、ネットワーク制限の可能性があります。",
      "CONNECT_TIMEOUT"
    );
  }

  // DNS
  if (
    blob.includes("enotfound") ||
    blob.includes("eai_again") ||
    blob.includes("getaddrinfo") ||
    blob.includes("dns") ||
    blob.includes("name not resolved") ||
    blob.includes("nxdomain")
  ) {
    return new AnalyzeError(
      "DNSの解決に失敗しました。ホスト名が正しいか、ドメインが存在するか確認してください。",
      "DNS_FAILED"
    );
  }

  // Generic connection failures
  if (
    blob.includes("econnrefused") ||
    blob.includes("econnreset") ||
    blob.includes("ehostunreach") ||
    blob.includes("enetunreach") ||
    blob.includes("socket hang up") ||
    blob.includes("und_err_socket") ||
    blob.includes("und_err_connect")
  ) {
    return new AnalyzeError(
      "対象サイトへ接続できませんでした。サイトがダウンしているか、アクセスが拒否された可能性があります。",
      "CONNECT_TIMEOUT"
    );
  }

  // SSL / TLS
  if (
    blob.includes("cert") ||
    blob.includes("ssl") ||
    blob.includes("tls") ||
    blob.includes("unable to verify")
  ) {
    return new AnalyzeError(
      "SSL/TLS接続に失敗しました。証明書に問題があるサイトの可能性があります。",
      "CONNECT_TIMEOUT"
    );
  }

  // Bare "fetch failed" without useful cause
  if (blob.includes("fetch failed") || top?.message === "fetch failed") {
    return new AnalyzeError(
      "対象サイトへの接続に失敗しました。URL・ネットワーク・ファイアウォールを確認するか、デモモードをお試しください。",
      "UNKNOWN"
    );
  }

  // Already user-facing Japanese from SSRF / validation
  if (top && isJapaneseUserMessage(top.message)) {
    const code = inferCodeFromMessage(top.message);
    return new AnalyzeError(top.message, code);
  }

  return new AnalyzeError(
    "ページの取得中に予期しないエラーが発生しました。URLを確認するか、デモモードをお試しください。",
    "UNKNOWN"
  );
}

function isJapaneseUserMessage(msg: string): boolean {
  return /[ぁ-んァ-ン一-龥]/.test(msg);
}

function inferCodeFromMessage(msg: string): AnalyzeErrorCode {
  if (msg.includes("DNS") || msg.includes("ホスト名を解決") || msg.includes("DNS解決"))
    return "DNS_FAILED";
  if (msg.includes("接続がタイムアウト") || msg.includes("接続に失敗"))
    return "CONNECT_TIMEOUT";
  if (msg.includes("12秒") || msg.includes("取得がタイムアウト"))
    return "FETCH_TIMEOUT";
  if (msg.includes("HTTP")) return "HTTP_ERROR";
  if (msg.includes("HTML以外")) return "NOT_HTML";
  if (msg.includes("解析")) return "PARSE_ERROR";
  if (
    msg.includes("プライベート") ||
    msg.includes("ローカルホスト") ||
    msg.includes("拒否") ||
    msg.includes("許可されていません")
  )
    return "SSRF_BLOCKED";
  if (msg.includes("リダイレクト")) return "REDIRECT_LIMIT";
  if (msg.includes("URL")) return "INVALID_URL";
  return "UNKNOWN";
}

/** Final guard so API never returns raw engine messages. */
export function toClientError(err: unknown): AnalyzeError {
  if (err instanceof AnalyzeError) return err;
  if (err instanceof Error && isJapaneseUserMessage(err.message)) {
    return new AnalyzeError(err.message, inferCodeFromMessage(err.message));
  }
  return classifyNetworkError(err);
}
