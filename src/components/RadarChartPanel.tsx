"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { RadarScores } from "@/lib/types";

type Props = {
  radarScores: RadarScores;
};

const AXES: { key: keyof RadarScores; label: string }[] = [
  { key: "seo", label: "SEO" },
  { key: "aeo", label: "AEO" },
  { key: "geo", label: "GEO" },
  { key: "eeat", label: "E-E-A-T" },
  { key: "entity", label: "Entity" },
  { key: "schema", label: "Schema" },
  { key: "readability", label: "Readability" },
  { key: "citationQuality", label: "Citation" },
];

export function RadarChartPanel({ radarScores }: Props) {
  const data = AXES.map((axis) => ({
    subject: axis.label,
    value: radarScores[axis.key],
    fullMark: 100,
  }));

  return (
    <div className="glass rounded-2xl p-4 sm:p-6">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">レーダーチャート</h3>
          <p className="mt-1 text-xs text-slate-400">
            SEO / AEO / GEO と診断サブスコア（8軸）
          </p>
        </div>
      </div>
      <div className="h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="rgba(148,163,184,0.2)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
            />
            <Radar
              name="Score"
              dataKey="value"
              stroke="#22d3ee"
              fill="#22d3ee"
              fillOpacity={0.28}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                background: "#0f1220",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        8軸: SEO · AEO · GEO · E-E-A-T · Entity · Schema · Readability ·
        Citation Quality。ChatGPT等の推定値は右のカードを参照。
      </p>
    </div>
  );
}
