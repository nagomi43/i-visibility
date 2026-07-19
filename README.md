# AI Visibility Score

URL を入力すると Web ページの HTML をサーバー側で取得・解析し、**SEO / AEO / GEO** の観点から「AI に引用・推薦されやすさ」を **0〜100 点のルールベース推定** で可視化する MVP です。

> **重要**: 本ツールのスコアは HTML シグナルに基づく再現可能な推定値です。ChatGPT・Gemini・Claude・Perplexity などの**実際の検索順位や引用頻度を測定したものではありません**。

## 技術構成

- Next.js 15（App Router）+ React 19 + TypeScript
- Tailwind CSS（ダーク／近未来 UI）
- Recharts（8 軸レーダーチャート）
- Cheerio（サーバー側 HTML 解析）
- `POST /api/analyze` で取得・解析（API キー不要）

## 起動方法（Windows）

```bash
npm.cmd install
npm.cmd run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

本番ビルド:

```bash
npm.cmd run build
npm.cmd start
```

型チェック / Lint:

```bash
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
```

## 使い方

1. トップ画面に `https://example.com` などの URL を入力
2. **Analyze** → `POST /api/analyze` が HTML を取得・解析
3. 結果画面に以下を表示
   - 円形ゲージ（総合 AI Visibility Score）
   - SEO / AEO / GEO カード
   - **8 軸レーダー**: SEO · AEO · GEO · E-E-A-T · Entity · Schema · Readability · Citation Quality
   - ChatGPT / Gemini / Claude / Perplexity の推定スコア（別カード）
   - 問題点一覧・改善提案・解析シグナル
4. 取得失敗時は **Demo data** で UI を確認可能

### API

```http
POST /api/analyze
Content-Type: application/json

{ "url": "https://example.com" }
```

デモ:

```http
POST /api/analyze
Content-Type: application/json

{ "demo": true }
```

成功時: `{ "ok": true, "result": { ... } }`  
失敗時: `{ "ok": false, "error": "日本語メッセージ", "code": "ERROR_CODE" }`

| code | 意味（例） |
|------|------------|
| `DNS_FAILED` | ホスト名を解決できない |
| `CONNECT_TIMEOUT` | 接続タイムアウト（`UND_ERR_CONNECT_TIMEOUT` 含む） |
| `FETCH_TIMEOUT` | 全体取得が 12 秒で打ち切り |
| `HTTP_ERROR` | 非 2xx の HTTP 応答 |
| `NOT_HTML` | HTML 以外の Content-Type |
| `PARSE_ERROR` | HTML 解析エラー |
| `SSRF_BLOCKED` | ローカル／プライベート宛先の拒否 |
| `REDIRECT_LIMIT` | リダイレクト 5 回超過 |
| `INVALID_URL` / `MISSING_URL` | URL 不正・未入力 |

生の `fetch failed` や undici の内部コードは **そのまま表示しません**。

## 解析項目（抜粋）

- title / meta description
- H1〜H6・見出し構造
- 内部リンク / 外部リンク（**外部先はクロールしない**）
- 画像 alt
- canonical / robots meta
- JSON-LD / Schema.org（FAQPage, HowTo, Organization, Person, BreadcrumbList など）
- author / Open Graph / Twitter Card
- 本文量、FAQ 的構造、出典表記
- `llms.txt` / `robots.txt` / `sitemap.xml` の有無（同一オリジンへの安全な GET プローブ）

## スコア仕様

各軸は **満点が正確に 100** になるようバケット配点しています（超過加算後に 100 切り詰めする方式ではありません）。

| スコア | 意味 |
|--------|------|
| SEO | オンページ SEO（title / 見出し / alt / OG / Twitter / 技術ファイル等） |
| AEO | 回答エンジン向け（見出し・本文量・HowTo。FAQPage は補助的） |
| GEO | 生成エンジン向け（構造化・著者・出典。**llms.txt は軽めの加点**） |
| 総合 | SEO×0.3 + AEO×0.35 + GEO×0.35 |

**SEO 100 点**には Open Graph・Twitter Card の充足と、画像がある場合の alt 完備が必要です。

### レーダー 8 軸（`radarScores`）

SEO / AEO / GEO に加え:

- **E-E-A-T** — 著者・組織・出典などの信頼プロキシ
- **Entity** — Organization / Person / WebSite 等のエンティティ明確さ
- **Schema** — JSON-LD の充実度
- **Readability** — 見出し・本文量・抜粋しやすさ
- **Citation Quality** — 出典・外部参照・正規 URL など

AI 別推定（ChatGPT 等）はレーダーには含めず、**別カード**で表示します。

### 問題・提案の方針

- **llms.txt 未設置**は Low（提案段階のシグナル）。重大問題や大幅減点にはしない
- **FAQPage Schema**は「FAQ らしい構造があるのに未マークアップ」のとき Medium。全サイト一律 High にしない

## セキュリティ（SSRF 対策）

- 許可スキーム: `http` / `https` のみ
- localhost / 127.0.0.1 / プライベート IP / 予約アドレス / メタデータ系ホストを拒否
- **DNS 解決後の宛先 IP** も検査
- **`redirect: "follow"` は使用しない**
  - リダイレクトは手動で最大 **5 回**
  - **各ホップの URL を取得前に** `validatePublicHttpUrl` で再検証
- 取得タイムアウト: 約 **12 秒**（全体）
- 外部リンク先は辿らない
- HTML は最大約 **2MB** まで（超過は先頭のみ解析）
- API キーや秘密情報は不要・コードに含めない

## アクセシビリティ（UI）

- 入力画面・結果画面とも **`<main>` ランドマーク**
- 見出し階層: ホームは `h1` → `h2`/`h3`、結果は `h1`（解析結果）→ 各パネル `h3`
- `:focus-visible` によるキーボードフォーカス表示
- 主要ボタンは最小高さ **44px**（`.btn-touch`）

## MVP の制限事項

- Core Web Vitals は PageSpeed / Lighthouse API を使わないため **「未測定」**
- スコアは実ランキングではなくルールベース推定
- JavaScript 実行後の DOM は取得できない（初期 HTML のみ）
- SPA や強い bot ブロック環境では解析失敗しやすい
- 多言語・高度な E-E-A-T 評価は簡易実装
- デモモードはサンプルシグナルで UI 確認用

## ブランド

- 製品名: **AI Visibility Score**
- ロゴ略称: **AIVS**

## ライセンス

Private MVP sample.
