import type { Issue, Severity } from "@/lib/types";

const severityStyles: Record<
  Severity,
  { badge: string; border: string }
> = {
  Critical: {
    badge: "bg-rose-500/15 text-rose-300 border-rose-400/30",
    border: "border-rose-400/20",
  },
  High: {
    badge: "bg-orange-500/15 text-orange-300 border-orange-400/30",
    border: "border-orange-400/15",
  },
  Medium: {
    badge: "bg-amber-500/15 text-amber-200 border-amber-400/25",
    border: "border-amber-400/10",
  },
  Low: {
    badge: "bg-slate-500/15 text-slate-300 border-slate-400/25",
    border: "border-white/8",
  },
};

export function IssuesList({ issues }: { issues: Issue[] }) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">問題点一覧</h3>
          <p className="mt-1 text-xs text-slate-400">
            重要度付きの検出結果（{issues.length}件）
          </p>
        </div>
      </div>
      <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto scrollbar-thin pr-1">
        {issues.length === 0 && (
          <li className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            重大な問題は検出されませんでした。
          </li>
        )}
        {issues.map((issue) => {
          const style = severityStyles[issue.severity];
          return (
            <li
              key={issue.id}
              className={`rounded-xl border bg-white/[0.02] px-4 py-3 ${style.border}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}
                >
                  {issue.severity}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">
                  {issue.category}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-100">
                {issue.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {issue.description}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
