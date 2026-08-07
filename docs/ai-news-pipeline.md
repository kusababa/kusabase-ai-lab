# AIニュース記事下書き自動生成パイプライン

`scripts/ai-news-pipeline/` に実装されている、記事作成を半自動化するパイプラインの説明である。**完全自動公開は行わない**。AIが下書きを作成しPull Requestを作成するところまでを自動化し、必ず人間がレビュー・マージしてから本番公開する運用にする。

## 全体の流れ

```
毎朝 cron（GitHub Actions） / または手動 workflow_dispatch
  ↓
News Collector（collect.ts）  各ソースを巡回し、data/seen.json未登録の新規ニュースだけ抽出
  ↓
Importance Scoring（score.ts）  Claude Haikuで0〜100点を採点、70点以上のみ候補化
  ↓
Article Draft Generator（generate.ts）  候補上位（既定3件/日）をClaude Sonnetで記事下書き化
  ↓
src/content/articles/ へ draft: true で保存
  ↓
GitHub Pull Request作成（1記事1PR、タイトル "AI News Draft: {記事タイトル}"）
  ↓
人間レビュー → マージ → 本番公開
```

## セットアップ

1. `ANTHROPIC_API_KEY` を取得し、GitHub Secretsに登録する（Settings → Secrets and variables → Actions）
2. ローカルで試す場合は、リポジトリ直下に `.env` を作成し `ANTHROPIC_API_KEY=sk-ant-...` を設定する（`.gitignore` 済み）
3. `.github/workflows/ai-news-pipeline.yml` の `schedule` トリガーは、動作確認が済むまでコメントアウトしておくことを推奨する（`workflow_dispatch` は常に使える）

## ローカルでの実行

```bash
npm run pipeline     # collect → score → generate を実行（git操作は一切行わない）
npm run dashboard     # http://localhost:4322 でその日の実行ログを確認（認証なし・ローカル専用）
```

実行結果は以下に出力される。

- `src/content/articles/{日付}-{slug}.md` — 生成された記事下書き（`draft: true`）
- `scripts/ai-news-pipeline/data/logs/{日付}.json` — 収集件数・候補数・生成件数・エラー履歴
- `scripts/ai-news-pipeline/data/seen.json` — 収集済みURLの台帳（重複排除・再スコアリング防止用、コミット対象）

## GitHub Actionsでの実行（`.github/workflows/ai-news-pipeline.yml`）

2つのジョブに分かれている。

- **Job1 `pipeline`**: `npm run pipeline` を実行し、`data/seen.json`・`data/logs/*.json` の更新を直接 `main` へpushする（内部ログのためPRレビュー対象にしない）。生成された下書きファイルはartifactとしてJob2へ引き渡す
- **Job2 `create-prs`**: Job1が出力した下書き件数ぶんだけ動的matrixで並列実行し、下書き1件につき専用ブランチ＋PRを作成する（0件の日はJob2自体がスキップされる）

## 収集元と既知の制約

`scripts/ai-news-pipeline/src/sources.ts` に一覧がある。実装時に各URLの疎通確認を行ったが、以下は自動収集できないことを確認しているため `enabled: false` にしてある（今後HTMLスクレイピング等の別実装が必要）。

| ソース | 状態 | 理由 |
| --- | --- | --- |
| Anthropic News | 無効 | 公式RSSフィード未提供（404） |
| xAI Blog | 無効 | bot対策と思われる403応答 |

「GitHub Trending AI」は公式フィードが存在しないため、GitHub Search API（`topic:ai` かつ直近作成・スター数順）による近似値で代替している。

## コスト目安・上限

Claude API公式料金（2026-08-07時点、`https://claude.com/pricing`）は以下の通り。

| モデル | 入力 | 出力 |
| --- | --- | --- |
| Haiku 4.5（スコアリング用） | $1 / MTok | $5 / MTok |
| Sonnet 5（記事生成用、〜2026/8/31導入価格） | $2 / MTok | $10 / MTok |
| Sonnet 5（2026/9/1以降の通常価格） | $3 / MTok | $15 / MTok |

想定トークン数（スコアリング: 入力約900+出力約150、生成: 入力約1,100+出力約1,200）で試算すると、通常運用では**1日あたり十数円、月あたり数百円程度**に収まる見込み。

### コスト暴走を防ぐ仕組み（実装済み）

収集元の不具合・フィード仕様変更等でAPI呼び出し件数が異常に増えないよう、以下の上限を設けている。

- **`MAX_ITEMS_SCORED_PER_RUN`**（既定60件、環境変数で変更可）: 1回の実行でスコアリングする件数の上限。超過分はAPIを呼ばずスキップし、ログに記録する
- **`MAX_DRAFTS_PER_DAY`**（既定3件、環境変数で変更可）: 記事生成（Sonnet）を呼び出す件数の上限
- **要約テキストの切り詰め**（`collect.ts`、500文字）: 記事全文をsummaryとして返すフィードがあっても、プロンプトサイズが青天井にならないようにする
- **出力トークン上限の分離**（`claude-client.ts`）: スコアリングは`max_tokens: 300`、記事生成は`max_tokens: 2048`に固定し、1件あたりの最悪コストを既知の値にする
- **`concurrency`設定**（`ai-news-pipeline.yml`）: 手動実行と定期実行が同時に走ってAPI課金が二重発生することを防ぐ
- **収集の直近日数フィルタ**（`COLLECT_LOOKBACK_DAYS`、既定3日）: 実装中に「OpenAIの全期間アーカイブ（1,113件）を毎回スコアリングしてしまう」不具合を実際に発見し修正した際に追加。フィードが全期間のアーカイブを返しても直近分のみに絞る

これらの上限がすべて働いた場合の**理論上の1日あたり絶対上限**（実際の出力はこれよりかなり小さいことがほとんど）:

| 期間 | 1日の絶対上限 | 1ヶ月の絶対上限 |
| --- | --- | --- |
| 〜2026/8/31（Sonnet導入価格） | 約$0.21（約32円） | 約$6.4（約960円） |
| 2026/9/1〜（Sonnet通常価格） | 約$0.25（約37円） | 約$7.4（約1,120円） |

コード側の対策とは別に、**Anthropic Console（`platform.claude.com`）でAPIキーに月次予算アラート・上限を設定しておくことを強く推奨する**。これはAnthropic側で強制される最終防御線であり、コード側の不具合とは独立して機能する。

## 品質担保の仕組み

- 生成プロンプトで単なる翻訳・転載を明示的に禁止し、「KusaBase視点の考察」セクションを必須にしている
- 生成結果はMarkdown文字列ではなくJSON構造で受け取り、`src/content/config.ts` と同期させたZodスキーマでバリデーションしてから書き出す。バリデーション失敗時はPRを作らずエラーログに記録する
- `author` フィールドに「（AI下書き・要レビュー）」を自動付与し、レビュー時にAI生成である旨が一目で分かるようにしている

## 将来拡張

`collect.ts` / `score.ts` / `generate.ts` を独立モジュール化してあるため、将来的に以下を追加する場合もこの構造を流用できる（今回は未実装）。

- 週刊AIまとめ自動生成
- ニュースレター生成
- X / LinkedIn投稿生成
- AIエージェントランキング生成
- Medical AIレポート生成
