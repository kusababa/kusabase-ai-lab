// 各ニュースソースを巡回し、data/seen.json未登録のNewsItemだけを集める

import Parser from 'rss-parser'
import { NEWS_SOURCES } from './sources'
import type { NewsItem, NewsSource, PipelineError } from './types'
import { loadSeen } from './storage'

const rssParser = new Parser()

// OpenAIブログ等、フィードが全期間のアーカイブを返すソースがあり、フィルタなしだと
// 初回実行時に千件単位の記事を収集・スコアリングしてしまう（実測で確認済み）ため、
// 直近N日以内に公開された項目のみを収集対象にする
const COLLECT_LOOKBACK_DAYS = 3

// 一部のRSSフィードは記事全文をsummaryとして返すことがあり、プロンプトサイズ（＝API課金）が
// 想定外に膨らむ要因になるため、NewsItemに格納する前に必ず切り詰める
const SUMMARY_MAX_LENGTH = 500

function truncateSummary(summary: string): string {
  const trimmed = summary.trim()
  return trimmed.length > SUMMARY_MAX_LENGTH ? `${trimmed.slice(0, SUMMARY_MAX_LENGTH)}…` : trimmed
}

function isWithinLookback(publishedAt: string): boolean {
  const publishedTime = new Date(publishedAt).getTime()
  if (Number.isNaN(publishedTime)) {
    return true
  }
  const cutoff = Date.now() - COLLECT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  return publishedTime >= cutoff
}

export interface CollectResult {
  /** data/seen.json 未登録の新規項目のみ（スコアリング対象） */
  newItems: NewsItem[]
  /** 重複排除前の総取得件数（ダッシュボードの「収集件数」表示用） */
  totalFetched: number
  errors: PipelineError[]
}

async function collectFromRss(source: NewsSource): Promise<NewsItem[]> {
  const feed = await rssParser.parseURL(source.url)
  return (feed.items ?? [])
    .filter((item) => item.link && item.title)
    .map((item) => ({
      sourceId: source.id,
      sourceName: source.name,
      title: item.title as string,
      url: item.link as string,
      publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
      summary: truncateSummary(item.contentSnippet ?? item.content ?? ''),
    }))
    .filter((item) => isWithinLookback(item.publishedAt))
}

interface GitHubSearchRepo {
  full_name: string
  html_url: string
  created_at: string
  description: string | null
  stargazers_count: number
}

interface GitHubSearchResponse {
  items: GitHubSearchRepo[]
}

async function collectFromGitHubSearch(source: NewsSource): Promise<NewsItem[]> {
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const url = source.url.replace('{since}', since)

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'kusabase-ai-lab-news-pipeline',
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`GitHub Search API failed: ${response.status} ${response.statusText}`)
  }
  const data = (await response.json()) as GitHubSearchResponse

  return data.items.map((repo) => ({
    sourceId: source.id,
    sourceName: source.name,
    title: `${repo.full_name}（★${repo.stargazers_count}）`,
    url: repo.html_url,
    publishedAt: repo.created_at,
    summary: truncateSummary(repo.description ?? ''),
  }))
}

export async function collectNews(): Promise<CollectResult> {
  const seen = await loadSeen()
  const errors: PipelineError[] = []
  const collected: NewsItem[] = []

  const activeSources = NEWS_SOURCES.filter((source) => source.enabled)

  for (const source of activeSources) {
    try {
      let items: NewsItem[]
      if (source.type === 'github-search') {
        items = await collectFromGitHubSearch(source)
      } else {
        items = await collectFromRss(source)
      }
      collected.push(...items)
    } catch (error) {
      errors.push({
        step: 'collect',
        sourceId: source.id,
        message: (error as Error).message,
      })
    }
  }

  const newItems = collected.filter((item) => !(item.url in seen))

  return { newItems, totalFetched: collected.length, errors }
}
