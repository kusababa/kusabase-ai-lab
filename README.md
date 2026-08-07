# KusaBase AI Lab

「AIを学び、試し、実装する。」をコンセプトとする実践型AIメディアサイト（[ai.kusabase.com](https://ai.kusabase.com)）。

AI最新情報・AIエージェント研究・自動化・開発ログ・医療AI・実践検証を発信する。運営元は [KusaBase](https://kusabase.com)。

## 技術スタック

| カテゴリ | 技術 |
| --- | --- |
| フレームワーク | Astro 4（完全SSG構成、`output: 'static'`） |
| 言語 | TypeScript（`astro/tsconfigs/strict`） |
| スタイリング | TailwindCSS |
| コンテンツ管理 | Astro Content Collections（Markdown） |
| 検索 | Pagefind（静的サイト内検索、ビルド後生成） |
| SEO | @astrojs/sitemap、独自RSS実装、JSON-LD（Article/WebPage/Organization/BreadcrumbList） |
| ホスティング | AWS S3 + CloudFront + Route53 + ACM |
| CI/CD | GitHub Actions |

## セットアップ

```bash
npm install
npm run dev       # http://localhost:4321 で起動
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド（`astro build` 実行後、Pagefindの検索インデックスを `dist/pagefind/` に生成） |
| `npm run preview` | ビルド済み `dist/` をローカルでプレビュー |

検索機能（Pagefind）はビルド時にインデックスを生成する都合上、`npm run dev` では動作しない。検索の動作確認は必ず `npm run build && npm run preview` で行うこと。

## ディレクトリ構成

```
src/
  layouts/       BaseLayout（全ページ共通）, ArticleLayout（記事詳細用）
  components/    Header, Footer, SEO, ArticleCard, Breadcrumbs, TableOfContents 等
  utils/         readingTime.ts（読了時間算出）, articles.ts（記事取得・関連記事・前後記事ロジック）
  consts.ts      サイト定数・カテゴリ⇔URLスラッグのマッピング・アクセントカラークラス定義
  content/
    config.ts    articlesコレクションのスキーマ定義
    articles/    記事Markdownファイル（ダミー記事12本を含む）
  pages/
    index.astro              トップページ
    about.astro               About
    search.astro               検索ページ（Pagefind UI）
    rss.xml.ts                 RSSフィード
    [category]/index.astro     カテゴリ別記事一覧（ページネーション付き）
    [category]/[slug].astro    記事詳細
    tags/[tag]/index.astro     タグ別記事一覧
public/          robots.txt, logo.svg, og-default.svg 等の静的アセット
docs/            AWSインフラ構築手順書等
.github/workflows/deploy.yml   GitHub Actionsによる自動デプロイ
```

## 記事の追加方法

`src/content/articles/` 配下に Markdown ファイルを追加する。frontmatterは以下のスキーマに従う（`src/content/config.ts` 参照）。

```yaml
---
title: "記事タイトル"
description: "検索結果・OGPに表示される説明文（120〜160文字程度を推奨）"
publishDate: 2026-08-07
category: "News" # News | AI Agents | Automation | Medical AI | Development | Weekly AI のいずれか
tags: ["タグ1", "タグ2"]
draft: false        # trueにすると一覧・検索・RSSから除外される
featured: false      # トップページ Featured Articles に表示するか
popular: false       # トップページ Popular Articles に表示するか（静的サイトのため手動指定）
heroImage: "/images/articles/example.jpg" # 省略可。未指定時はカードにプレースホルダーを表示
---

## 見出し2

本文...
```

見出し（`##`/`###`）は記事詳細ページの目次に自動反映される。カテゴリと記事のURLスラッグ対応は `src/consts.ts` の `CATEGORIES` で一元管理している。

## デプロイ

`main` ブランチへのpushで `.github/workflows/deploy.yml` が実行され、ビルド後に S3 へ同期、CloudFrontのキャッシュを無効化する。以下のGitHub Secretsの設定が必要。

| Secret名 | 内容 |
| --- | --- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | デプロイ用IAMユーザーの認証情報 |
| `S3_BUCKET` | デプロイ先S3バケット名 |
| `CLOUDFRONT_DISTRIBUTION_ID` | キャッシュ無効化対象のCloudFront Distribution ID |

AWS側（S3/CloudFront/Route53/ACM）の実際のリソース構築手順は [`docs/deploy-aws.md`](./docs/deploy-aws.md) を参照。**本リポジトリの初期構築時点ではAWSリソースは未作成のため、上記手順書に沿って先にインフラを準備すること。**

## 今後の実装予定（未着手）

- **デザインアセット**: `public/logo.svg` / `public/og-default.svg` はプレースホルダー。正式なロゴ・OGP画像（PNG/JPG推奨）への差し替えが必要
- **Google AdSense**: `src/components/AdSlot.astro` に広告枠のプレースホルダーを用意済み。審査通過後にAdSenseスクリプト・ins要素を組み込む
- **ニュースレター配信**: `src/components/NewsletterCTA.astro` はUIのみの「準備中」表示。配信基盤（メール配信サービス等）は未実装
- **AI記事生成パイプライン**: 海外ニュース収集→AI要約→Markdown生成→人間レビュー→公開、という運用フローは今回のスコープ外。完全自動公開は行わない方針
- **app.kusabase.com のAIエージェント群**（問い合わせAI・医療向けAI・LINE対応AI）: `about.astro` に導線のみ用意済み。実装は別プロジェクト

## デザイン方針

Anthropic風の「落ち着いた高級感」を目指し、アイボリー・グレージュを基調としたグレースケール中心の配色に、カテゴリごとの低彩度アクセントカラーを最小限に使用する（`tailwind.config.mjs` の `accent.*` 参照）。過度なアニメーションは避け、ホバー等の控えめなトランジションのみを使用する。
