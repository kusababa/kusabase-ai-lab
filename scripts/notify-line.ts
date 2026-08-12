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
  description: string
  url: string
  heroImageUrl?: string
}

// LINE Flex Messageの画像コンポーネントはJPEG/PNGのみ対応（SVG不可）。
// カテゴリ別デフォルト画像（CATEGORY_IMAGES）は現状すべてSVGのため、
// heroImageがラスター画像として明示設定されている記事のみ画像付きカードにする
const RASTER_IMAGE_PATTERN = /\.(png|jpe?g|webp)$/i

function resolveHeroImageUrl(heroImage: unknown): string | undefined {
  if (typeof heroImage !== 'string' || !RASTER_IMAGE_PATTERN.test(heroImage)) {
    return undefined
  }
  return heroImage.startsWith('http') ? heroImage : `${SITE_URL}${heroImage}`
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
    description: typeof data.description === 'string' ? data.description : '',
    url: `${SITE_URL}/${category.slug}/${filename}/`,
    heroImageUrl: resolveHeroImageUrl(data.heroImage),
  }
}

// LINE Flex Messageのbubble（カード）を組み立てる。heroImageUrlが無い場合は画像なしのテキストカードにする
function buildFlexMessage(article: PublishedArticle) {
  const bodyContents: Record<string, unknown>[] = [
    { type: 'text', text: '新着記事', size: 'xs', color: '#A69E8F', weight: 'bold' },
    { type: 'text', text: article.title, weight: 'bold', size: 'md', wrap: true, margin: 'sm' },
  ]
  if (article.description) {
    bodyContents.push({ type: 'text', text: article.description, size: 'sm', color: '#736C60', wrap: true, margin: 'md' })
  }

  return {
    type: 'flex',
    altText: `新着記事: ${article.title}`,
    contents: {
      type: 'bubble',
      ...(article.heroImageUrl
        ? { hero: { type: 'image', url: article.heroImageUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } }
        : {}),
      body: { type: 'box', layout: 'vertical', contents: bodyContents },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#2B2823',
            action: { type: 'uri', label: '記事を読む', uri: article.url },
          },
        ],
      },
    },
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
        messages: group.map(buildFlexMessage),
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
