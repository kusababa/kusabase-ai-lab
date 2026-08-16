# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「AIを学び、試し、実装する。」をコンセプトとする実践型AIメディアサイト（[ai.kusabase.com](https://ai.kusabase.com)）。Astro 4の完全SSG構成で構築しており、SSRは使用しない。姉妹サイトのkusabase.com（`C:\Users\hyayj\Developer\portfolio`、別リポジトリ）とデザイン思想・CI/CD構成の統一性を持たせている。

## コマンド

```bash
npm install        # 依存パッケージインストール
npm run dev         # 開発サーバー（http://localhost:4321）
npm run build        # 本番ビルド（astro build → pagefind --site dist の順に実行）
npm run preview       # ビルド済みdist/のプレビュー
npm run pipeline      # AIニュース収集→スコアリング→記事生成をローカル実行（要 ANTHROPIC_API_KEY、git操作は行わない）
npm run dashboard      # http://localhost:4322 でパイプラインの実行ログを確認（認証なし・ローカル専用）
```

lint・テストのコマンドは現時点で未設定（ESLint/Prettier/テストフレームワークいずれも未導入）。

検索機能（Pagefind）は `npm run build` 実行時にのみ `dist/pagefind/` へインデックスが生成されるため、`npm run dev` では動作しない。検索の動作確認は必ず `npm run build && npm run preview` で行うこと。

## アーキテクチャ

- Astro 4の完全SSG構成（`output: 'static'`）。`trailingSlash: 'always'`、`applyBaseStyles: false`（Tailwindのbase styleは `src/styles/global.css` で手動管理）。`.astro` コンポーネントのみを使用し、React/Vue等のUIフレームワーク統合は導入していない
- **記事データ**: `src/content/config.ts` の `articles` コレクション（type: content）で管理。実データは `src/content/articles/*.md`。frontmatterスキーマ（title/description/publishDate/category/tags/draft/featured/popular/heroImage/author）はこのファイルが正
- **カテゴリの一元管理**: `src/consts.ts` の `CATEGORIES` にカテゴリ名⇔URLスラッグ⇔Tailwindアクセントカラーキーの対応をまとめている。カテゴリを追加・変更する場合は、このファイルと `src/content/config.ts` の `category` enum を**同時に**更新する必要がある
- **ルーティング**: 記事詳細は `src/pages/[category]/[slug].astro`、カテゴリ一覧（ページネーション付き）は `src/pages/[category]/[...page].astro`。URL形式は `/{カテゴリスラッグ}/{記事ファイル名}/`（例: `/news/news-1/`）
- **記事取得ロジックの共通化**: `src/utils/articles.ts` に公開記事の取得・ソート・カテゴリ絞り込み・関連記事・前後記事・タグ集計を集約している。ページ側で `getCollection` を直接叩かず、このモジュール経由で取得すること
- **読了時間**: `src/utils/readingTime.ts`。英語圏の「単語数÷分速」ではなく、Markdown記法を除去した日本語の文字数を約500文字/分で割って概算する方式
- **目次（TOC）**: 追加のremarkプラグインは使わず、Astro Content Collectionsの `entry.render()` が返す `headings`（h2/h3のみ抽出）をそのまま利用
- **レイアウト階層**: `BaseLayout.astro`（Header/Footer/SEO差し込みを含む全ページ共通の外枠）を `ArticleLayout.astro`（パンくず/目次/タグ/広告枠/関連記事/前後記事を含む記事詳細専用レイアウト）が内包する構造
- **SEO**: `SEO.astro` がcanonical/OGP/Twitter Card/JSON-LD（Article or WebPage、Organization、BreadcrumbList）をまとめて出力。RSSは `@astrojs/rss` を使わず `src/pages/rss.xml.ts` で自前生成
- **Pagefindの索引範囲**: `data-pagefind-body` を `ArticleLayout.astro` の記事本文ラッパーにのみ付与している。この属性を使うとサイト全体の索引対象が「この属性を持つ要素のみ」に切り替わる仕様のため、検索対象は記事本文に限定され、Header/Footer/About等は索引対象外になる（意図した挙動）
- **Tailwindアクセントカラー**: JITは完全なクラス名文字列しか検出できないため、`text-accent-${key}` のような動的生成はできない。`src/consts.ts` の `ACCENT_CLASSES` に完全なクラス名を列挙する方式にしている
- **カテゴリ別デフォルト画像**: `src/consts.ts` の `CATEGORY_IMAGES`（`getCategoryImage()`経由）が、記事frontmatterに`heroImage`が無い場合のフォールバック画像（`public/images/categories/{slug}.svg`）を提供する。`ArticleCard.astro`（一覧のサムネイル）と`ArticleLayout.astro`（OGP画像）の両方がこのフォールバックを使う
- **AIニュース記事下書き自動生成パイプライン**（`scripts/ai-news-pipeline/`）: Astroサイト本体とは独立したNode/TypeScriptスクリプト群。`collect.ts`（ニュース収集）→`score.ts`（Claude Haikuで重要度スコアリング）→`generate.ts`（Claude Sonnetで記事構造をJSON生成し `src/content/config.ts` 相当のZodスキーマで検証後Markdown化）の順で実行され、`npm run pipeline` がエントリポイント。git操作は一切行わず、コミット・PR作成は `.github/workflows/ai-news-pipeline.yml` 側に分離している。**`draft: false` で生成しており、完全自動公開はしないもののPRのマージ操作そのものが公開の最終承認になる**（GitHub Mobileアプリでの通知確認→マージのみで運用する設計。詳細は `docs/ai-news-pipeline.md` を参照）
- **LINE公式アカウントへの新着記事通知**（`scripts/notify-line.ts`）: `.github/workflows/deploy.yml` のデプロイ完了後に実行され、`main`へのpush前後の差分で**新規追加(`git diff --diff-filter=A`)された** `src/content/articles/*.md` のみを検知し、`draft: false` のものをLINE Messaging APIでFlex Message（タイトル・説明文・「記事を読む」ボタン付きのカード形式）としてブロードキャスト配信する。既存記事の編集では通知しない。`LINE_CHANNEL_ACCESS_TOKEN`（GitHub Secret）未設定・API失敗時は常に正常終了しデプロイに影響しない。セットアップ手順は `docs/line-notify.md` を参照

## 既知の落とし穴

- **`@astrojs/sitemap` はpackage.jsonで `3.2.1` に完全固定**（キャレットを付けない）こと。3.7.x系はAstro 5で追加された `astro:routes:resolved` フックを前提にしており、Astro 4.16では発火しないため `Cannot read properties of undefined (reading 'reduce')` でビルドが壊れる（実際に発生し確認済み）
- カテゴリ一覧ページは `[category]/index.astro` ではなく **`[category]/[...page].astro`** というファイル名にする必要がある。Astroの `paginate()` はルートパスにページ番号パラメータを含むファイル名を要求するため
- `scripts/ai-news-pipeline/src/sources.ts` の収集元のうち、Anthropic Newsとxaiは公式RSSが存在しない/bot対策で自動取得できないことを確認済みのため `enabled: false` にしてある。有効化する場合は別途スクレイピング実装が必要
- **`public/` 直下にファイル名固定で置く画像（`logo.svg` / `og-default.svg` / `AILab_icon.png` / `AILab_logo.png` / `images/*`）は、`.github/workflows/deploy.yml` の長期キャッシュ（`max-age=31536000, immutable`）から明示的に除外し、no-cache側に含める必要がある。** AstroがビルドするJS/CSSはコンテンツハッシュ付きファイル名になるため1年キャッシュしても安全だが、`public/`の画像は中身だけ差し替える運用のためファイル名が変わらず、除外し忘れると更新してもブラウザに永久に反映されない不具合になる（実際に発生し、修正済み）。新しくファイル名固定の画像を`public/`に追加する場合は、この除外リストにも追加すること
- **AIニュースパイプラインのcronは`UTC 22:00`指定（JST 7:00相当）のため、`data/logs/{date}.json`のファイル名やAI生成記事の`publishDate`はUTC基準の日付になり、JSTでの「実行日の翌日」を指すように見える。** 例えばJST 8/8朝に実行された分のログは`2026-08-07.json`という名前になる。動作上の問題ではないが、日付を見て混乱しないこと
- **LINE通知（`scripts/notify-line.ts`）は`git diff`でpush前後の差分を取るため、`.github/workflows/deploy.yml`の`checkout`ステップに`fetch-depth: 0`が必要。** シャロークローンのままだと差分元コミットが存在せず`git diff`が失敗する
- **LINE Flex Messageの画像コンポーネントはJPEG/PNGのみ対応でSVG不可。** `src/consts.ts`の`CATEGORY_IMAGES`（`heroImage`未指定時のフォールバック）は現状すべてSVGのため、`scripts/notify-line.ts`は`heroImage`がラスター画像（png/jpg/webp）の場合のみ画像付きカードにし、それ以外はテキストのみのカードにフォールバックする
- **`scripts/ai-news-pipeline/src/collect.ts`のRSS/HTTP取得には必ずタイムアウトを指定すること。** `rssParser`（`new Parser({ timeout: ... })`）や`fetch`（`AbortSignal.timeout(...)`）にタイムアウトが無いと、収集元サーバーが応答を返さずコネクションを張ったままにした際に`collectNews()`の`for`ループごと無期限にハングする。try/catchはエラーを投げないハングを捕捉できないため防げない（実際にGitHub Actions上で3時間以上停止する事故が発生し、`REQUEST_TIMEOUT_MS = 15000`の設定で解消・確認済み）。あわせて`.github/workflows/ai-news-pipeline.yml`の`pipeline`ジョブに`timeout-minutes: 15`を設定し、万一同種のハングが再発してもActionsのデフォルト上限（6時間）まで実行時間を浪費しない多重防御にしている
- **`scripts/ai-news-pipeline/src/run.ts`の`main()`は、処理が全て正常終了した後も明示的に`process.exit(0)`を呼ぶ必要がある。** `rss-parser`がRSSフィード取得時に張るHTTP接続（keep-alive等）が処理完了後も内部に残り、`process.exit()`を呼ばないとNode.jsのイベントループが自然には終了せずプロセスがハングし続ける（ログ上は`[ai-news-pipeline] 完了`まで正常出力された数秒後、実際には15分間プロセスが宙に浮いたまま停止し`timeout-minutes`で強制キャンセルされる事象をローカル・GitHub Actions両方で再現・確認済み）。上記のRSS取得タイムアウトとは別原因・別対処なので混同しないこと

## デプロイ・インフラ

- kusabase.com（`C:\Users\hyayj\Developer\portfolio`）のCI/CD構成を踏襲し、`.github/workflows/deploy.yml` からアクセスキー方式でAWSへ認証、S3を「長期キャッシュ資産」と「no-cacheのHTML/robots/sitemap/rss/pagefindインデックス」の二段階でsyncした後にCloudFront invalidationを実行する
- AWS側（S3/CloudFront/Route53/ACM）の手動構築手順は `docs/deploy-aws.md` を参照
- **本番のCloudFront側で、末尾スラッシュURL（`trailingSlash: 'always'` により全ページがこの形式）を `index.html` に補完するCloudFront Functionの設定が別途必要**（CloudFrontの「デフォルトルートオブジェクト」はルート `/` にしか効かず、`/news/` のようなサブパスには適用されないため）。また非公開S3バケット（OAC構成）は存在しないオブジェクトに対して404ではなく403を返すため、カスタムエラーレスポンスは404だけでなく403も `/404.html` にマッピングする必要がある。このCloudFront Function設定手順は `docs/deploy-aws.md` に未反映のため、インフラ構築時は本ファイルの記述もあわせて参照すること

## デザイン方針

Anthropic風の「落ち着いた高級感」。アイボリー（`ivory.*`）・グレージュ（`greige.*`）を基調とし、テキストはグレースケール（`charcoal.*`）で統一する。カテゴリ別アクセントカラー（`accent.*`）は低彩度で、バッジ・ボーダー・薄い背景（opacity低め）にのみ使用し、大面積の塗りやボタン背景には使わない。過度なアニメーションは禁止し、ホバー時の色変化程度の控えめなトランジションのみ許可する。

## 未実装・スコープ外

- AWS実リソースの新規作成は完了済みだが、CloudFront Functionの `docs/deploy-aws.md` への反映は未対応（上記参照）
- Google AdSenseの実申請・スクリプト組み込み（`AdSlot.astro` はプレースホルダーのみ）
- ニュースレター配信基盤（`NewsletterCTA.astro` はUIのみの「準備中」表示）
- LINE公式アカウントによる新着記事通知（`scripts/notify-line.ts` / `LineFriendCTA.astro`）は本稼働中。`LINE_CHANNEL_ACCESS_TOKEN`（GitHub Secret）・`src/consts.ts`の`LINE_FRIEND_URL`とも設定済みで、新規記事のマージ時にブロードキャスト配信される（セットアップ手順は`docs/line-notify.md`を参照）
- app.kusabase.com側のAIエージェント実装（問い合わせAI・医療向けAI・LINE対応AI）
- AIニュース記事下書き自動生成パイプライン（`scripts/ai-news-pipeline/`）は本稼働中（`ANTHROPIC_API_KEY`登録済み、`schedule`トリガー有効、毎朝の自動実行→PR作成→マージによる公開まで実績あり）。週刊AIまとめ・ニュースレター・X/LinkedIn投稿生成・AIエージェントランキング・Medical AIレポートへの拡張は未着手（Collector/Scorer/Generatorを独立モジュール化してあるため拡張は容易）
