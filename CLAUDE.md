# CLAUDE.md

このファイルはKusaBase AI Labリポジトリで作業する際のガイドラインを記載する。

## コマンド

```bash
npm install        # 依存パッケージインストール
npm run dev         # 開発サーバー（http://localhost:4321）
npm run build        # 本番ビルド（astro build → pagefind --site dist）
npm run preview       # ビルド済みdist/のプレビュー
```

検索機能（Pagefind）は `npm run build` 時にのみインデックスが生成されるため、`npm run dev` では動作しない。検索確認は `npm run build && npm run preview` で行うこと。

## アーキテクチャ

- Astro 4 の完全SSG構成（`output: 'static'`）。SSRは使用しない
- `trailingSlash: 'always'`、`applyBaseStyles: false`（Tailwindのbase styleは `src/styles/global.css` で手動管理）
- `.astro` コンポーネントのみを使用し、React/Vue等のUIフレームワーク統合は導入していない
- 記事は Astro Content Collections（`src/content/articles/*.md`）で管理。スキーマは `src/content/config.ts`
- カテゴリ⇔URLスラッグの対応、アクセントカラーのTailwindクラス名は `src/consts.ts` に一元管理している。カテゴリを追加・変更する場合はこのファイルと `src/content/config.ts` の `category` enum を同時に更新すること
- 記事URLは `/{カテゴリスラッグ}/{ファイル名（slug)}/` の形式（例: `/news/openai-next-gen/`）

## Key decisions

- **記事URL構造**: `[category]/[slug].astro` の動的ルートを採用。カテゴリ一覧ページ（`[category]/index.astro`）は同じ `[category]` セグメントを使い、Astroの `paginate()` でカテゴリごとにページネーションしている
- **読了時間の算出方式**: 英語圏で一般的な「単語数÷分速」ではなく、日本語の文字数（Markdown記法を除去した本文の文字数）を約500文字/分で割って概算している（`src/utils/readingTime.ts`）
- **人気記事（Popular Articles）の選定方法**: 静的サイトのためアクセス解析に基づく自動集計は行わず、frontmatterの `popular: true` で手動指定する運用とした
- **目次（TOC）の実装**: 追加のremarkプラグインは使わず、Astro Content Collectionsの `entry.render()` が返す `headings`（h2/h3のみ抽出）をそのまま利用している
- **Pagefindのインデックス範囲**: `src/layouts/ArticleLayout.astro` の記事本文ラッパーにのみ `data-pagefind-body` を付与している。この属性を使うと、Pagefindの索引対象がサイト全体で「この属性を持つ要素のみ」に切り替わる仕様のため、結果として検索対象は記事本文に限定され、Header/Footer/About等のページは索引対象外となる。これは意図した挙動である
- **RSS**: `@astrojs/rss` は導入せず、`src/pages/rss.xml.ts` で手動生成している
- **デプロイ方式**: kusabase.com（`C:\Users\hyayj\Developer\portfolio`）のCI/CD構成を踏襲し、GitHub Actionsからアクセスキー方式でAWSへ認証、S3を「長期キャッシュ資産」と「no-cacheのHTML/robots/sitemap/rss/pagefindインデックス」の二段階でsyncした後にCloudFront invalidationを実行する構成とした

## デザイン方針

Anthropic風の「落ち着いた高級感」。アイボリー（`ivory.*`）・グレージュ（`greige.*`）を基調とし、テキストはグレースケール（`charcoal.*`）で統一する。カテゴリ別アクセントカラー（`accent.*`）は低彩度で、バッジ・ボーダー・薄い背景（opacity低め）にのみ使用し、大面積の塗りやボタン背景には使わない。過度なアニメーションは禁止し、ホバー時の色変化程度の控えめなトランジションのみ許可する。

TailwindのJIT解析はソースコード中の完全なクラス名文字列しか検出できないため、`text-accent-${key}` のような動的生成は行わず、`src/consts.ts` の `ACCENT_CLASSES` に完全なクラス名を列挙する方式にしている。

## 未実装・今回のスコープ外

- AWS実リソース（S3/CloudFront/Route53/ACM）の作成（手順は `docs/deploy-aws.md`）
- Google AdSenseの実申請・スクリプト組み込み（`AdSlot.astro` はプレースホルダーのみ）
- ニュースレター配信基盤
- AI記事自動生成パイプライン（海外ニュース収集→AI要約→Markdown生成→人間レビュー→公開）。完全自動公開は行わない方針
- app.kusabase.com側のAIエージェント実装
