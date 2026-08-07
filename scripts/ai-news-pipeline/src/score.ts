// 収集したNewsItemをClaude(Haiku)で重要度スコアリングする

import { requestJson, SCORING_MODEL } from './claude-client'
import { loadSeen, saveSeen, todayIso } from './storage'
import type { NewsItem, PipelineError, ScoredItem, ScoreResult } from './types'

const SCORE_THRESHOLD = 70
const MAX_DRAFTS_PER_DAY = Number(process.env.MAX_DRAFTS_PER_DAY ?? 3)

// collect.ts側の不具合・想定外のフィード仕様変更等で異常な件数が来た場合でも、
// API課金が青天井にならないようスコアリング件数そのものに上限を設ける（二重の保険）
const MAX_ITEMS_SCORED_PER_RUN = Number(process.env.MAX_ITEMS_SCORED_PER_RUN ?? 60)

// スコアリング結果は数個の数値と一言の理由のみのため、出力トークンを小さく固定してコストの上振れを防ぐ
const SCORING_MAX_OUTPUT_TOKENS = 300

const SYSTEM_PROMPT = `あなたはAIメディア「KusaBase AI Lab」の編集アシスタントです。
与えられたニュース1件について、以下5つの観点で0〜100のスコアを付け、必ずJSONのみで回答してください（説明文やコードフェンスは不要です）。

- industryImpact: AI業界全体への影響度
- developerImpact: 開発者・エンジニアへの実務的な影響度
- japanRelevance: 日本国内の読者・市場にとっての関連度
- medicalAiRelevance: 医療AI分野との関連度（関連が薄い場合は低スコアでよい）
- agentRelevance: AIエージェント分野との関連度（関連が薄い場合は低スコアでよい）
- overallScore: 上記を総合したこのニュースの掲載優先度（記事化する価値があるほど高スコア）
- reasoning: overallScoreの根拠を日本語一文で

出力形式:
{"industryImpact":0,"developerImpact":0,"japanRelevance":0,"medicalAiRelevance":0,"agentRelevance":0,"overallScore":0,"reasoning":""}`

function buildUserPrompt(item: NewsItem): string {
  return `ソース: ${item.sourceName}\nタイトル: ${item.title}\nURL: ${item.url}\n公開日時: ${item.publishedAt}\n概要: ${item.summary || '(概要なし)'}`
}

export interface ScoreOutput {
  /** スコアリングに成功した全件（seen.json登録済み） */
  scoredItems: ScoredItem[]
  /** overallScore >= 70 の全件（上限適用前、ログのcandidates件数用） */
  allCandidates: ScoredItem[]
  /** allCandidatesのうちスコア降順で上位MAX_DRAFTS_PER_DAY件（下書き生成対象） */
  draftTargets: ScoredItem[]
  errors: PipelineError[]
}

export async function scoreNews(newItems: NewsItem[]): Promise<ScoreOutput> {
  const errors: PipelineError[] = []
  const scoredItems: ScoredItem[] = []

  const targetItems = newItems.slice(0, MAX_ITEMS_SCORED_PER_RUN)
  const skippedCount = newItems.length - targetItems.length
  if (skippedCount > 0) {
    errors.push({
      step: 'score',
      message: `MAX_ITEMS_SCORED_PER_RUN(${MAX_ITEMS_SCORED_PER_RUN})の上限に達したため、${skippedCount}件をスコアリングせずスキップしました（コスト上限保護）`,
    })
  }

  for (const item of targetItems) {
    try {
      const score = await requestJson<ScoreResult>(SCORING_MODEL, SYSTEM_PROMPT, buildUserPrompt(item), SCORING_MAX_OUTPUT_TOKENS)
      scoredItems.push({ item, score })
    } catch (error) {
      errors.push({
        step: 'score',
        sourceId: item.sourceId,
        message: `[${item.title}] ${(error as Error).message}`,
      })
    }
  }

  // スコア判定できた項目は結果に関わらずseen.jsonへ登録し、翌日以降の再スコアリング（＝API課金の重複）を防ぐ
  if (scoredItems.length > 0) {
    const seen = await loadSeen()
    const today = todayIso()
    for (const scored of scoredItems) {
      seen[scored.item.url] = today
    }
    await saveSeen(seen)
  }

  const allCandidates = scoredItems
    .filter((scored) => scored.score.overallScore >= SCORE_THRESHOLD)
    .sort((a, b) => b.score.overallScore - a.score.overallScore)

  const draftTargets = allCandidates.slice(0, MAX_DRAFTS_PER_DAY)

  return { scoredItems, allCandidates, draftTargets, errors }
}
