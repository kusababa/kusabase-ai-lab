import { getCollection, type CollectionEntry } from 'astro:content'
import { getCategoryByName } from '../consts'

export type ArticleEntry = CollectionEntry<'articles'>

// draft記事を除いた全記事を公開日の新しい順に取得する
export async function getPublishedArticles(): Promise<ArticleEntry[]> {
  const entries = await getCollection('articles', ({ data }) => !data.draft)
  return entries.sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
}

export async function getArticlesByCategory(categoryName: ArticleEntry['data']['category']): Promise<ArticleEntry[]> {
  const articles = await getPublishedArticles()
  return articles.filter((article) => article.data.category === categoryName)
}

export async function getFeaturedArticles(limit = 4): Promise<ArticleEntry[]> {
  const articles = await getPublishedArticles()
  return articles.filter((article) => article.data.featured).slice(0, limit)
}

export async function getPopularArticles(limit = 4): Promise<ArticleEntry[]> {
  const articles = await getPublishedArticles()
  return articles.filter((article) => article.data.popular).slice(0, limit)
}

export async function getLatestArticles(limit = 6): Promise<ArticleEntry[]> {
  const articles = await getPublishedArticles()
  return articles.slice(0, limit)
}

// 同カテゴリの記事から、現在の記事を除いた新着順の関連記事を取得する
export async function getRelatedArticles(current: ArticleEntry, limit = 3): Promise<ArticleEntry[]> {
  const sameCategory = await getArticlesByCategory(current.data.category)
  return sameCategory.filter((article) => article.slug !== current.slug).slice(0, limit)
}

export interface PrevNextResult {
  prev: ArticleEntry | null
  next: ArticleEntry | null
}

// 同カテゴリ内・公開日昇順での前後記事を返す（prevは1つ古い記事、nextは1つ新しい記事）
export async function getPrevNextArticle(current: ArticleEntry): Promise<PrevNextResult> {
  const sameCategory = (await getArticlesByCategory(current.data.category))
    .slice()
    .sort((a, b) => a.data.publishDate.valueOf() - b.data.publishDate.valueOf())

  const index = sameCategory.findIndex((article) => article.slug === current.slug)
  if (index === -1) {
    return { prev: null, next: null }
  }

  return {
    prev: index > 0 ? sameCategory[index - 1] : null,
    next: index < sameCategory.length - 1 ? sameCategory[index + 1] : null,
  }
}

export function getArticleUrl(article: ArticleEntry): string {
  const category = getCategoryByName(article.data.category)
  return `/${category.slug}/${article.slug}/`
}

export async function getAllTags(): Promise<string[]> {
  const articles = await getPublishedArticles()
  const tagSet = new Set<string>()
  for (const article of articles) {
    for (const tag of article.data.tags) {
      tagSet.add(tag)
    }
  }
  return [...tagSet].sort()
}

export async function getArticlesByTag(tag: string): Promise<ArticleEntry[]> {
  const articles = await getPublishedArticles()
  return articles.filter((article) => article.data.tags.includes(tag))
}
