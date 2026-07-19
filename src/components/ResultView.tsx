"use client";

import type { AnalysisResult } from "@/lib/types";
import { ScoreGauge } from "./ScoreGauge";
import { ScoreCards } from "./ScoreCards";
import { RadarChartPanel } from "./RadarChartPanel";
import { AiEstimateCards } from "./AiEstimateCards";
import { IssuesList } from "./IssuesList";
import { RecommendationsList } from "./RecommendationsList";
import { SignalsPanel } from "./SignalsPanel";

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ResultView({
  result,
  onReset,
}: {
  result: AnalysisResult;
  onReset: () => void;
}) {
  const isDemo = result.mode === "demo";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                isDemo
                  ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                  : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
              }`}
            >
              {isDemo ? "demo data" : "live analysis"}
            </span>
            <span className="text-[11px] text-slate-500">
              {formatDate(result.analyzedAt)}
            </span>
          </div>
          <h1 className="mt-2 text-lg font-semibold text-white sm:text-xl">
            解析結果
          </h1>
          <p className="mt-1 break-all font-mono text-xs text-cyan-200/80 sm:text-sm">
            {result.url}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="btn-touch shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-white/10"
        >
          別のURLを解析
        </button>
      </div>

      <div className="glass rounded-3xl p-6 sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[280px_1fr]">
          <ScoreGauge score={result.scores.overall} />
          <div className="space-y-4">
            <ScoreCards scores={result.scores} />
            <p className="text-[11px] leading-relaxed text-slate-500">
              {result.disclaimer}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RadarChartPanel radarScores={result.radarScores} />
        <AiEstimateCards scores={result.aiEstimates} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <IssuesList issues={result.issues} />
        <RecommendationsList
          recommendations={result.recommendations}
          predicted={result.predictedScores}
          currentOverall={result.scores.overall}
        />
      </div>

      <SignalsPanel result={result} />
    </div>
  );
}
