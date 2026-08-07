// AI記事下書き自動生成パイプライン共通型定義

import type { CategoryName } from '../../../src/consts'

/** ニュース収集元の種別（rss/github-releasesはrss-parserで、github-searchはGitHub REST APIで処理する） */
export type SourceType = 'rss' | 'github-releases' | 'github-search'

/** ニュース収集元の優先度 */
export type SourceTier = 'high' | 'mid'

export interface NewsSource {
  id: string
  name: string
  tier: SourceTier
  type: SourceType
  url: string
  /** falseの場合はcollect.tsが巡回対象から除外する（フィード未整備・bot対策等の理由でTODOにしているもの） */
  enabled: boolean
  /** enabled: false のソースについて、無効化している理由を残す */
  note?: string
}

/** collect.ts が取得する生のニュース項目 */
export interface NewsItem {
  sourceId: string
  sourceName: string
  title: string
  url: string
  publishedAt: string
  summary: string
}

/** score.ts が返すスコアリング結果 */
export interface ScoreResult {
  industryImpact: number
  developerImpact: number
  japanRelevance: number
  medicalAiRelevance: number
  agentRelevance: number
  overallScore: number
  reasoning: string
}

export interface ScoredItem {
  item: NewsItem
  score: ScoreResult
}

/** generate.ts がClaudeへ生成させる構造化データ */
export interface GeneratedArticle {
  title: string
  description: string
  category: CategoryName
  tags: string[]
  slug: string
  sections: {
    summary: string
    whatChanged: string
    developerImpact: string
    kusabasePerspective: string
    forecast: string
  }
}

/** Job1→Job2受け渡し用の下書きマニフェスト1件分 */
export interface DraftManifestEntry {
  filePath: string
  title: string
  slug: string
  branch: string
  overallScore: number
  sourceUrl: string
  sourceName: string
}

export interface PipelineError {
  step: 'collect' | 'score' | 'generate'
  sourceId?: string
  message: string
}

/** data/logs/YYYY-MM-DD.json の形式（ダッシュボードが参照） */
export interface RunLog {
  date: string
  collected: number
  candidates: number
  draftsGenerated: number
  errors: PipelineError[]
  items: Array<{
    title: string
    sourceName: string
    overallScore: number
    status: 'candidate' | 'draft_created' | 'validation_failed'
  }>
}
