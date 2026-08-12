// 新規公開された記事をLINE公式アカウントの友だち全員にブロードキャスト通知する。
// 対象は「push前後の差分でファイルが新規追加(A)された記事」のみ。既存記事の編集では通知しない。
// サイトのデプロイを絶対に壊さないよう、どのようなエラーでも exit 0 で終了する。

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'
import matter from 'gray-matter'
import { CATEGORIES, SITE_URL } from '../src/consts'

const ARTICLES_PREFIX = 'src/content/articles/'
const ZERO_SHA = '0000000000000000000000000000000000000000'
const BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast'
const CHUNK_SIZE = 5

interface PublishedArticle {
  title: string
  url: string
}

function getAddedArticleFiles(before: string, after: string): string[] {
  if (!before || !after || before === ZERO_SHA) {
    console.log('[notify-line] 初回pushのため差分検知をスキップします')
    return []
  }

  const output = execFileSync(
    'git',
    ['diff', '--name-status', '--diff-filter=A', before, after, '--', ARTICLES_PREFIX],
    { encoding: 'utf-8' },
  )

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('A\t'))
    .map((line) => line.slice(2).trim())
    .filter((file) => file.endsWith('.md'))
}

async function toPublishedArticle(filePath: string): Promise<PublishedArticle | null> {
  const raw = await fs.readFile(path.join(process.cwd(), filePath), 'utf-8')
  const { data } = matter(raw)

  if (data.draft === true) {
    return null
  }

  const category = CATEGORIES.find((c) => c.name === data.category)
  if (!category || typeof data.title !== 'string') {
    console.warn(`[notify-line] frontmatterが不正なためスキップ: ${filePath}`)
    return null
  }

  const filename = path.basename(filePath, '.md')
  return {
    title: data.title,
    url: `${SITE_URL}/${category.slug}/${filename}/`,
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function broadcast(token: string, articles: PublishedArticle[]): Promise<void> {
  for (const group of chunk(articles, CHUNK_SIZE)) {
    const response = await fetch(BROADCAST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: group.map((article) => ({
          type: 'text',
          text: `新着記事: ${article.title}\n${article.url}`,
        })),
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error(`[notify-line] LINE API呼び出しに失敗しました (status: ${response.status}): ${body}`)
      continue
    }

    console.log(`[notify-line] ${group.length}件を配信しました: ${group.map((a) => a.title).join(', ')}`)
  }
}

async function main(): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.log('[notify-line] LINE_CHANNEL_ACCESS_TOKEN未設定のため配信をスキップします')
    return
  }

  const before = process.env.GIT_DIFF_BEFORE ?? ''
  const after = process.env.GIT_DIFF_AFTER ?? ''
  const addedFiles = getAddedArticleFiles(before, after)

  if (addedFiles.length === 0) {
    console.log('[notify-line] 新規追加された記事がないため配信をスキップします')
    return
  }

  const articles = (await Promise.all(addedFiles.map(toPublishedArticle))).filter(
    (a): a is PublishedArticle => a !== null,
  )

  if (articles.length === 0) {
    console.log('[notify-line] 配信対象の公開記事がないためスキップします')
    return
  }

  await broadcast(token, articles)
}

main().catch((error) => {
  console.error('[notify-line] 予期しないエラーが発生しましたが、デプロイには影響させません:', error)
})
