"use client";

type Props = {
  score: number;
  label?: string;
  size?: number;
};

function scoreColor(score: number): string {
  if (score >= 80) return "#22d3ee";
  if (score >= 60) return "#60a5fa";
  if (score >= 40) return "#a78bfa";
  return "#f472b6";
}

export function ScoreGauge({ score, label = "総合スコア", size = 220 }: Props) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c - (clamped / 100) * c;
  const color = scoreColor(clamped);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(148,163,184,0.12)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{
              filter: `drop-shadow(0 0 10px ${color}66)`,
              transition: "stroke-dashoffset 0.8s ease",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-5xl font-semibold tabular-nums tracking-tight text-white sm:text-6xl">
            {clamped}
          </span>
          <span className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            / 100
          </span>
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-200">{label}</p>
      <p className="mt-1 text-xs text-slate-500">AI Visibility Score</p>
    </div>
  );
}
