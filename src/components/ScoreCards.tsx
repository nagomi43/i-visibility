import type { ScoreBreakdown } from "@/lib/types";

const cards: {
  key: keyof ScoreBreakdown;
  title: string;
  subtitle: string;
  accent: string;
}[] = [
  {
    key: "seo",
    title: "SEO Score",
    subtitle: "検索エンジン最適化",
    accent: "from-cyan-400/20 to-transparent border-cyan-400/20",
  },
  {
    key: "aeo",
    title: "AEO Score",
    subtitle: "回答エンジン最適化",
    accent: "from-blue-400/20 to-transparent border-blue-400/20",
  },
  {
    key: "geo",
    title: "GEO Score",
    subtitle: "生成エンジン最適化",
    accent: "from-violet-400/20 to-transparent border-violet-400/20",
  },
];

export function ScoreCards({ scores }: { scores: ScoreBreakdown }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.key}
          className={`glass rounded-2xl border bg-gradient-to-br p-4 sm:p-5 ${c.accent}`}
        >
          <p className="text-xs text-slate-400">{c.subtitle}</p>
          <p className="mt-1 text-sm font-medium text-slate-200">{c.title}</p>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-white">
            {scores[c.key]}
            <span className="ml-1 text-sm font-normal text-slate-500">/100</span>
          </p>
        </div>
      ))}
    </div>
  );
}
