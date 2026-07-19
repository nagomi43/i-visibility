import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { AnalyzeError } from "./errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function isPrivateOrReservedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const ranges: [number, number][] = [
    [ipv4ToInt("0.0.0.0"), ipv4ToInt("0.255.255.255")],
    [ipv4ToInt("10.0.0.0"), ipv4ToInt("10.255.255.255")],
    [ipv4ToInt("100.64.0.0"), ipv4ToInt("100.127.255.255")],
    [ipv4ToInt("127.0.0.0"), ipv4ToInt("127.255.255.255")],
    [ipv4ToInt("169.254.0.0"), ipv4ToInt("169.254.255.255")],
    [ipv4ToInt("172.16.0.0"), ipv4ToInt("172.31.255.255")],
    [ipv4ToInt("192.0.0.0"), ipv4ToInt("192.0.0.255")],
    [ipv4ToInt("192.0.2.0"), ipv4ToInt("192.0.2.255")],
    [ipv4ToInt("192.168.0.0"), ipv4ToInt("192.168.255.255")],
    [ipv4ToInt("198.18.0.0"), ipv4ToInt("198.19.255.255")],
    [ipv4ToInt("198.51.100.0"), ipv4ToInt("198.51.100.255")],
    [ipv4ToInt("203.0.113.0"), ipv4ToInt("203.0.113.255")],
    [ipv4ToInt("224.0.0.0"), ipv4ToInt("239.255.255.255")],
    [ipv4ToInt("240.0.0.0"), ipv4ToInt("255.255.255.255")],
  ];
  return ranges.some(([start, end]) => n >= start && n <= end);
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80")) return true; // link-local
  if (normalized.startsWith("ff")) return true; // multicast
  // IPv4-mapped IPv6
  if (normalized.includes(".")) {
    const mapped = normalized.split(":").pop();
    if (mapped && isIP(mapped) === 4) {
      return isPrivateOrReservedIPv4(mapped);
    }
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateOrReservedIPv4(ip);
  if (version === 6) return isPrivateOrReservedIPv6(ip);
  return true;
}

export type ValidatedUrl = {
  href: string;
  hostname: string;
  origin: string;
};

/**
 * Validates user-supplied URL for safe server-side fetch (SSRF hardening).
 */
export async function validatePublicHttpUrl(raw: string): Promise<ValidatedUrl> {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new AnalyzeError("有効なURLを入力してください。", "INVALID_URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AnalyzeError(
      "http または https のURLのみ許可されています。",
      "INVALID_URL"
    );
  }

  if (parsed.username || parsed.password) {
    throw new AnalyzeError(
      "認証情報を含むURLは許可されていません。",
      "INVALID_URL"
    );
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (!hostname) {
    throw new AnalyzeError("ホスト名が不正です。", "INVALID_URL");
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new AnalyzeError(
      "ローカルホストへのアクセスは許可されていません。",
      "SSRF_BLOCKED"
    );
  }

  // Direct IP in hostname
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new AnalyzeError(
        "プライベートIPや予約済みアドレスへのアクセスは拒否されます。",
        "SSRF_BLOCKED"
      );
    }
  } else {
    // Resolve DNS and block private answers
    try {
      const results = await lookup(hostname, { all: true, verbatim: true });
      if (!results.length) {
        throw new AnalyzeError(
          "DNSの解決に失敗しました。ホスト名が正しいか、ドメインが存在するか確認してください。",
          "DNS_FAILED"
        );
      }
      for (const r of results) {
        if (isBlockedIp(r.address)) {
          throw new AnalyzeError(
            "解決先がプライベート/予約済みIPのため、安全のためアクセスを拒否しました。",
            "SSRF_BLOCKED"
          );
        }
      }
    } catch (e) {
      if (e instanceof AnalyzeError) throw e;
      throw new AnalyzeError(
        "DNSの解決に失敗しました。ホスト名が正しいか、ドメインが存在するか確認してください。",
        "DNS_FAILED"
      );
    }
  }

  return {
    href: parsed.href,
    hostname: parsed.hostname,
    origin: parsed.origin,
  };
}
