// collect → score → generate を順に実行し、ログと下書きマニフェストを出力するエントリポイント。
// git操作は一切行わない（ローカル実行・GitHub Actions実行のどちらでも同じ挙動にするため、
// コミットやPR作成はワークフロー側（.github/workflows/ai-news-pipeline.yml）に分離している）。

import { collectNews } from './collect'
import { scoreNews } from './score'
import { generateDrafts } from './generate'
import { saveRunLog, savePendingDrafts, todayIso } from './storage'
import type { PipelineError, RunLog } from './types'

async function main() {
  const date = todayIso()
  const errors: PipelineError[] = []

  console.log(`[ai-news-pipeline] 開始: ${date}`)

  const collectResult = await collectNews()
  errors.push(...collectResult.errors)
  console.log(`[collect] 総取得: ${collectResult.totalFetched}件 / 新規: ${collectResult.newItems.length}件 / エラー: ${collectResult.errors.length}件`)

  const scoreResult = await scoreNews(collectResult.newItems)
  errors.push(...scoreResult.errors)
  console.log(`[score] スコアリング成功: ${scoreResult.scoredItems.length}件 / 候補(70点以上): ${scoreResult.allCandidates.length}件 / エラー: ${scoreResult.errors.length}件`)

  const generateResult = await generateDrafts(scoreResult.draftTargets)
  errors.push(...generateResult.errors)
  console.log(`[generate] 下書き生成: ${generateResult.drafts.length}件 / エラー: ${generateResult.errors.length}件`)

  const draftedUrls = new Set(generateResult.drafts.map((d) => d.sourceUrl))
  const items: RunLog['items'] = scoreResult.allCandidates.map((scored) => {
    let status: 'candidate' | 'draft_created' | 'validation_failed' = 'candidate'
    if (draftedUrls.has(scored.item.url)) {
      status = 'draft_created'
    } else if (generateResult.validationFailedTitles.includes(scored.item.title)) {
      status = 'validation_failed'
    }
    return {
      title: scored.item.title,
      sourceName: scored.item.sourceName,
      overallScore: scored.score.overallScore,
      status,
    }
  })

  const runLog: RunLog = {
    date,
    collected: collectResult.totalFetched,
    candidates: scoreResult.allCandidates.length,
    draftsGenerated: generateResult.drafts.length,
    errors,
    items,
  }

  await saveRunLog(runLog)
  await savePendingDrafts(generateResult.drafts)

  console.log(`[ai-news-pipeline] 完了: ログを data/logs/${date}.json に保存しました`)
  if (errors.length > 0) {
    console.warn(`[ai-news-pipeline] ${errors.length}件のエラーが発生しました（詳細はログ参照）`)
  }
}

main().catch((error) => {
  console.error('[ai-news-pipeline] 致命的エラー:', error)
  process.exitCode = 1
})
