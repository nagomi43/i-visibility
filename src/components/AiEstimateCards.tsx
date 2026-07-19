import type { AiEstimateScores } from "@/lib/types";

const items: { key: keyof AiEstimateScores; name: string; hint: string }[] = [
  { key: "chatgpt", name: "ChatGPT", hint: "回答抽出・FAQ親和" },
  { key: "gemini", name: "Gemini", hint: "構造化・サイト発見性" },
  { key: "claude", name: "Claude", hint: "信頼・出典・本文深度" },
  { key: "perplexity", name: "Perplexity", hint: "引用・出典・構造化" },
];

export function AiEstimateCards({ scores }: { scores: AiEstimateScores }) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-white">
        AIごとの推定スコア
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        AI引用されやすさの推定値（ルールベース）
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-100">{item.name}</p>
                <p className="text-[11px] text-slate-500">{item.hint}</p>
              </div>
              <p className="font-mono text-2xl font-semibold tabular-nums text-cyan-soft">
                {scores[item.key]}
              </p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                style={{ width: `${scores[item.key]}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
