import type { KeywordAnalysis } from "@/lib/types";

function ScoreCell({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
  muted?: boolean;
}) {
  if (value === null) {
    return (
      <div
        className={`rounded-xl border px-3 py-3 ${
          muted
            ? "border-white/5 bg-white/[0.02] opacity-60"
            : "border-white/8 bg-white/[0.03]"
        }`}
      >
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="mt-1 text-sm text-slate-500">—</p>
      </div>
    );
  }

  const color =
    value >= 70
      ? "text-cyan-soft"
      : value >= 45
        ? "text-slate-100"
        : "text-amber-200";

  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        highlight
          ? "border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 to-violet-500/10"
          : "border-white/8 bg-white/[0.03]"
      }`}
    >
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${color}`}>
        {value}
        <span className="ml-1 text-xs font-normal text-slate-500">/100</span>
      </p>
    </div>
  );
}

export function KeywordAnalysisPanel({
  analysis,
}: {
  analysis: KeywordAnalysis;
}) {
  const s = analysis.scores;

  return (
    <section
      className="glass rounded-2xl p-4 sm:p-6"
      aria-labelledby="keyword-analysis-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="keyword-analysis-heading"
            className="text-sm font-semibold text-white"
          >
            キーワード分析
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            title / description / H1–H3 / 本文 / FAQ / JSON-LD / 出典 /
            具体例に基づくルールベース評価
          </p>
        </div>
        {analysis.hasKeyword && analysis.keyword ? (
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              分析キーワード
            </p>
            <p className="font-medium text-cyan-100">{analysis.keyword}</p>
          </div>
        ) : (
          <div className="max-w-xs rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-slate-400">
            キーワード未入力のため、サイト構造のみ分析しています
          </div>
        )}
      </div>

      {analysis.noKeywordNotice && (
        <p
          className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90"
          role="status"
        >
          {analysis.noKeywordNotice}
        </p>
      )}

      <p className="mt-4 text-sm leading-relaxed text-slate-300">
        {analysis.summary}
      </p>

      {/* Scores grid */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <ScoreCell label="キーワード関連性" value={s.keywordRelevance} />
        <ScoreCell label="検索意図一致度" value={s.searchIntentMatch} />
        <ScoreCell label="回答カバー率" value={s.answerCoverage} />
        <ScoreCell label="質問カバー率" value={s.questionCoverage} />
        <ScoreCell label="トピック網羅性" value={s.topicCoverage} />
        {analysis.hasKeyword && (
          <ScoreCell
            label="Query Visibility"
            value={s.queryVisibilityScore}
            highlight={s.queryVisibilityScore !== null}
            muted={s.queryVisibilityScore === null}
          />
        )}
      </div>

      {/* Match signals */}
      <div className="mt-6">
        <h4 className="text-xs font-medium text-slate-300">一致シグナル</h4>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {analysis.matchSignals.map((sig) => (
            <li
              key={sig.id}
              className={`rounded-xl border px-3 py-2 text-xs ${
                sig.matched
                  ? "border-emerald-400/25 bg-emerald-500/10"
                  : "border-white/8 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    sig.matched ? "text-emerald-300" : "text-slate-500"
                  }
                  aria-hidden
                >
                  {sig.matched ? "✓" : "–"}
                </span>
                <span
                  className={
                    sig.matched
                      ? "font-medium text-emerald-100"
                      : "text-slate-400"
                  }
                >
                  {sig.label}
                </span>
              </div>
              <p className="mt-1 pl-5 text-[11px] text-slate-500">
                {sig.detail}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Missing items */}
      <div className="mt-6">
        <h4 className="text-xs font-medium text-slate-300">不足項目</h4>
        {analysis.missingItems.length === 0 ? (
          <p className="mt-2 text-xs text-emerald-200/90">
            主要な不足項目は検出されませんでした。
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {analysis.missingItems.map((item) => (
              <li
                key={item}
                className="flex gap-2 rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-xs text-amber-50/90"
              >
                <span className="text-amber-300/80" aria-hidden>
                  !
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Optional AI questions detail */}
      {analysis.questionDetails.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-medium text-slate-300">
            AI想定質問の内訳
          </h4>
          <ul className="mt-2 space-y-2">
            {analysis.questionDetails.map((q) => (
              <li
                key={q.question}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-slate-100">{q.question}</p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      q.covered
                        ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-400/30 bg-amber-500/10 text-amber-100"
                    }`}
                  >
                    {q.covered ? "カバー" : "弱い"} · {q.score}
                  </span>
                </div>
                {q.evidence && (
                  <p className="mt-1 text-[11px] text-slate-500">{q.evidence}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
