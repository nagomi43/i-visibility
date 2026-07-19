export function Header() {
  return (
    <header className="relative z-20 border-b border-white/5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-violet-500/20 shadow-glow"
            aria-hidden
          >
            <span className="font-mono text-[11px] font-bold tracking-tight text-cyan-soft">
              AIVS
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white sm:text-base">
              AI Visibility Score
            </p>
            <p className="hidden text-[11px] text-slate-400 sm:block">
              SEO × AEO × GEO ルールベース推定
            </p>
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-400">
          MVP
        </div>
      </div>
    </header>
  );
}
