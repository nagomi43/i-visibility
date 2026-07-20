import { NextRequest, NextResponse } from "next/server";
import { analyzeUrl } from "@/lib/analyze";
import { getDemoAnalysisResult } from "@/lib/demo-data";
import { toClientError } from "@/lib/errors";
import { normalizeKeywordInput } from "@/lib/keyword-analysis";
import { consumeAnalysisRateLimit } from "@/lib/rate-limit";
import type { AnalyzeApiResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_REQUEST_BYTES = 32_000;

function getClientKey(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown-client";
}

export async function POST(req: NextRequest) {
  const rate = consumeAnalysisRateLimit(getClientKey(req));
  if (!rate.allowed) {
    const payload: AnalyzeApiResponse = {
      ok: false,
      error: "解析回数の上限に達しました。しばらく待ってから再試行してください。",
      code: "RATE_LIMITED",
    };
    return NextResponse.json(payload, {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(rate.retryAfterSeconds),
      },
    });
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    const payload: AnalyzeApiResponse = {
      ok: false,
      error: "リクエストが大きすぎます。入力内容を短くしてください。",
      code: "PAYLOAD_TOO_LARGE",
    };
    return NextResponse.json(payload, { status: 413 });
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      url?: string;
      demo?: boolean;
      keyword?: string;
      questions?: string[] | string;
    } | null;

    if (body?.demo === true) {
      const result = getDemoAnalysisResult();
      const payload: AnalyzeApiResponse = { ok: true, result };
      return NextResponse.json(payload);
    }

    const url = body?.url?.trim();
    if (!url) {
      const payload: AnalyzeApiResponse = {
        ok: false,
        error: "URLを入力してください。",
        code: "MISSING_URL",
      };
      return NextResponse.json(payload, { status: 400 });
    }

    // questions: string[] or newline-separated string
    let questions: string[] | undefined;
    if (Array.isArray(body?.questions)) {
      questions = body.questions.filter((q): q is string => typeof q === "string");
    } else if (typeof body?.questions === "string") {
      questions = body.questions
        .split(/\r?\n/)
        .map((q) => q.trim())
        .filter(Boolean);
    }

    const keywordInput = normalizeKeywordInput({
      keyword: body?.keyword,
      questions,
    });

    const result = await analyzeUrl(url, keywordInput);
    const payload: AnalyzeApiResponse = { ok: true, result };
    return NextResponse.json(payload);
  } catch (e) {
    const client = toClientError(e);
    const payload: AnalyzeApiResponse = {
      ok: false,
      error: client.message,
      code: client.code,
    };
    return NextResponse.json(payload, { status: 400 });
  }
}
