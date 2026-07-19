import type { AnalysisResult } from "@/lib/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2 text-xs last:border-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right text-slate-200 break-all">{value}</span>
    </div>
  );
}

function yn(v: boolean): string {
  return v ? "あり" : "なし";
}

export function SignalsPanel({ result }: { result: AnalysisResult }) {
  const s = result.signals;
  return (
    <div className="glass rounded-2xl p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-white">解析シグナル概要</h3>
      <p className="mt-1 text-xs text-slate-400">
        Cheerio による読み取り専用解析結果
      </p>
      <div className="mt-3">
        <Row label="Title" value={s.title || "—"} />
        <Row
          label="Description"
          value={
            s.metaDescription
              ? `${s.metaDescription.slice(0, 80)}${s.metaDescription.length > 80 ? "…" : ""}`
              : "—"
          }
        />
        <Row
          label="見出し"
          value={`H1:${s.headings.h1} H2:${s.headings.h2} H3:${s.headings.h3}`}
        />
        <Row
          label="リンク"
          value={`内部 ${s.internalLinks} / 外部 ${s.externalLinks}`}
        />
        <Row
          label="画像 alt"
          value={`${s.imagesWithAlt}/${s.imagesTotal}`}
        />
        <Row label="canonical" value={s.canonical || "—"} />
        <Row label="robots meta" value={s.robotsMeta || "—"} />
        <Row label="JSON-LD" value={`${s.jsonLdCount} 件`} />
        <Row
          label="Schema 種類"
          value={s.schema.types.length ? s.schema.types.join(", ") : "—"}
        />
        <Row label="FAQPage" value={yn(s.schema.hasFaqPage)} />
        <Row label="HowTo" value={yn(s.schema.hasHowTo)} />
        <Row label="Organization" value={yn(s.schema.hasOrganization)} />
        <Row label="Person" value={yn(s.schema.hasPerson)} />
        <Row label="BreadcrumbList" value={yn(s.schema.hasBreadcrumbList)} />
        <Row label="Author" value={s.authorText || (s.hasAuthor ? "検出" : "—")} />
        <Row label="本文量（推定）" value={`${s.wordCount} 語相当`} />
        <Row label="FAQ的構造" value={yn(s.hasFaqLikeStructure)} />
        <Row label="出典表記" value={yn(s.hasCitationMarkers)} />
        <Row label="llms.txt" value={yn(s.hasLlmsTxt)} />
        <Row label="robots.txt" value={yn(s.hasRobotsTxt)} />
        <Row label="sitemap.xml" value={yn(s.hasSitemap)} />
        <Row
          label="Core Web Vitals"
          value={`LCP/INP/CLS: ${result.coreWebVitals.lcp}`}
        />
      </div>
    </div>
  );
}
