import { NextRequest, NextResponse } from "next/server";
import { analyzeUrl } from "@/lib/analyze";
import { getDemoAnalysisResult } from "@/lib/demo-data";
import { toClientError } from "@/lib/errors";
import type { AnalyzeApiResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      url?: string;
      demo?: boolean;
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

    const result = await analyzeUrl(url);
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
