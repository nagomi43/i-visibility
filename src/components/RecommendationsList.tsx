import type { PredictedScores, Recommendation } from "@/lib/types";

type Props = {
  recommendations: Recommendation[];
  predicted: PredictedScores;
  currentOverall: number;
};

export function RecommendationsList({
  recommendations,
  predicted,
  currentOverall,
}: Props) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-white">AI改善提案</h3>
      <p className="mt-1 text-xs text-slate-400">
        改善内容と予測効果（ルールベース推定。実順位・実引用の保証ではありません）
      </p>

      <div className="mt-4 rounded-xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-violet-500/10 p-4">
        <p className="text-xs text-slate-400">改善後の予測スコア（総合）</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-sm text-slate-400">
            {currentOverall}
          </span>
          <span className="text-slate-500">→</span>
          <span className="font-mono text-3xl font-semibold text-cyan-soft">
            {predicted.overall}
          </span>
          <span className="text-xs text-slate-500">/100</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-lg bg-black/20 px-2 py-2">
            <p className="text-slate-500">SEO</p>
            <p className="font-mono text-slate-200">{predicted.seo}</p>
          </div>
          <div className="rounded-lg bg-black/20 px-2 py-2">
            <p className="text-slate-500">AEO</p>
            <p className="font-mono text-slate-200">{predicted.aeo}</p>
          </div>
          <div className="rounded-lg bg-black/20 px-2 py-2">
            <p className="text-slate-500">GEO</p>
            <p className="font-mono text-slate-200">{predicted.geo}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          {predicted.note}
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {recommendations.map((rec, i) => (
          <li
            key={rec.id}
            className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 font-mono text-[11px] text-violet-soft">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100">{rec.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {rec.description}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-cyan-200/90">
                  <span className="font-medium text-cyan-100/90">予測効果: </span>
                  {rec.predictedEffect}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
