"use client";

import { useState } from "react";
import type { AnalysisResult, AnalyzeApiResponse } from "@/lib/types";
import { Header } from "./Header";
import { ResultView } from "./ResultView";

function parseQuestionsField(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function AnalyzerApp() {
  const [url, setUrl] = useState("https://example.com");
  const [keyword, setKeyword] = useState("");
  const [questionsText, setQuestionsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function runAnalyze(payload: {
    url?: string;
    demo?: boolean;
    keyword?: string;
    questions?: string[];
  }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as AnalyzeApiResponse;
      if (!data.ok) {
        setResult(null);
        setError(data.error || "解析に失敗しました。");
        return;
      }
      setResult(data.result);
    } catch {
      setResult(null);
      setError(
        "通信エラーが発生しました。ネットワークを確認するか、デモモードをお試しください。"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const questions = parseQuestionsField(questionsText);
    const payload: {
      url: string;
      keyword?: string;
      questions?: string[];
    } = { url };
    const kw = keyword.trim();
    if (kw) payload.keyword = kw;
    if (questions.length > 0) payload.questions = questions;
    void runAnalyze(payload);
  }

  function handleDemo() {
    void runAnalyze({ demo: true });
  }

  function handleReset() {
    setResult(null);
    setError(null);
  }

  const questionLines = questionsText.split(/\r?\n/).filter((l) => l.trim());
  const questionOver = questionLines.length > 3;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10">
        <Header />

        {!result ? (
          <main
            id="main-content"
            className="mx-auto flex max-w-3xl flex-col px-4 pb-20 pt-12 sm:px-6 sm:pt-20 lg:px-8"
          >
            <div className="text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-400">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"
                  aria-hidden
                />
                ルールベース AI Visibility 診断
              </p>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                AIに引用・推薦されやすい
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-transparent">
                  サイトかを、100点で可視化
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
                URLを入力すると HTML を解析し、SEO / AEO / GEO
                の観点から AI Visibility Score を推定します。キーワードや AI
                想定質問は任意です。
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="glass input-glow mt-10 space-y-3 rounded-2xl p-3 sm:p-4"
              aria-label="URL解析フォーム"
            >
              <div>
                <label
                  htmlFor="url"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  URL <span className="text-rose-300/80">必須</span>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    id="url"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-transparent bg-black/30 px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/20 sm:text-base"
                    disabled={loading}
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading || questionOver}
                    className="btn-touch shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-void-950 shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "解析中…" : "Analyze"}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="keyword"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  メインキーワード{" "}
                  <span className="font-normal text-slate-600">任意</span>
                </label>
                <input
                  id="keyword"
                  type="text"
                  placeholder="例: 生成AI SEO"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  maxLength={120}
                  className="min-h-11 w-full rounded-xl border border-transparent bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/20"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="questions"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  AI想定質問{" "}
                  <span className="font-normal text-slate-600">
                    任意・最大3件・1行1質問
                  </span>
                </label>
                <textarea
                  id="questions"
                  rows={3}
                  placeholder={"例:\n生成AI時代のSEOとは？\nAEOとSEOの違いは？"}
                  value={questionsText}
                  onChange={(e) => setQuestionsText(e.target.value)}
                  className="w-full resize-y rounded-xl border border-transparent bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/20"
                  disabled={loading}
                />
                <p
                  className={`mt-1 text-[11px] ${
                    questionOver ? "text-rose-300" : "text-slate-600"
                  }`}
                >
                  {questionOver
                    ? "質問は最大3行までです。余分な行を削除してください。"
                    : `${Math.min(questionLines.length, 3)} / 3 件`}
                </p>
              </div>
            </form>

            <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleDemo}
                disabled={loading}
                className="btn-touch rounded-xl border border-violet-400/30 bg-violet-500/10 px-5 py-2.5 text-sm text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-60"
              >
                Demo data
              </button>
              <p className="text-center text-[11px] text-slate-500">
                デモ: キーワード「生成AI SEO」/ 質問「生成AI時代のSEOとは？」
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
              >
                <p className="font-medium">解析エラー</p>
                <p className="mt-1 text-rose-100/90">{error}</p>
                <button
                  type="button"
                  onClick={handleDemo}
                  className="btn-touch mt-3 rounded-lg px-3 text-sm text-violet-200 underline-offset-2 hover:underline"
                >
                  代わりにデモデータを表示
                </button>
              </div>
            )}

            <section className="mt-12" aria-labelledby="score-axes-heading">
              <h2 id="score-axes-heading" className="sr-only">
                スコアの観点
              </h2>
              <div className="grid gap-3 text-left sm:grid-cols-3">
                {[
                  {
                    t: "SEO",
                    d: "title・見出し・内部リンク・技術ファイルなど",
                  },
                  {
                    t: "AEO",
                    d: "FAQ・HowTo・回答しやすい本文構造",
                  },
                  {
                    t: "GEO",
                    d: "構造化データ・著者・出典・llms.txt（任意）",
                  },
                ].map((x) => (
                  <div
                    key={x.t}
                    className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"
                  >
                    <h3 className="text-xs font-semibold tracking-wide text-cyan-200/90">
                      {x.t}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {x.d}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </main>
        ) : (
          <main id="main-content" className="pt-8">
            <ResultView result={result} onReset={handleReset} />
          </main>
        )}

        <footer className="border-t border-white/5 py-8 text-center text-[11px] text-slate-600">
          AI Visibility Score MVP — 読み取り専用解析 / APIキー不要
        </footer>
      </div>
    </div>
  );
}
