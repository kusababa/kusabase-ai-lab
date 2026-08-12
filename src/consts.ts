// サイト全体で共有する定数・カテゴリ⇔URLスラッグのマッピング

export const SITE_TITLE = 'KusaBase AI Lab'
export const SITE_DESCRIPTION = 'AIを学び、試し、実装する。AI最新情報・AIエージェント研究・自動化・開発ログ・医療AI・実践検証を発信する実践型AIメディア。'
export const SITE_URL = 'https://ai.kusabase.com'

// LINE公式アカウントの友だち追加用URL。Basic ID（@から始まるID）から生成される固定フォーマット
// https://line.me/R/ti/p/@{Basic ID} を使用（未設定の間は空文字のまま＝CTAは「準備中」表示になる）
export const LINE_FRIEND_URL = 'https://line.me/R/ti/p/@595yfxim'

export type CategoryName =
  | 'News'
  | 'AI Agents'
  | 'Automation'
  | 'Medical AI'
  | 'Development'
  | 'Weekly AI'

export interface CategoryInfo {
  name: CategoryName
  slug: string
  // tailwind.config.mjs の accent.* トークンと対応するキー
  accentKey: 'news' | 'agents' | 'automation' | 'medical' | 'development' | 'weekly'
  description: string
}

export const CATEGORIES: CategoryInfo[] = [
  { name: 'News', slug: 'news', accentKey: 'news', description: 'AIの最新ニュースを速報でお届けします。' },
  { name: 'AI Agents', slug: 'agents', accentKey: 'agents', description: 'AIエージェントの研究・活用事例をまとめます。' },
  { name: 'Automation', slug: 'automation', accentKey: 'automation', description: 'AIによる業務自動化・効率化のノウハウを紹介します。' },
  { name: 'Medical AI', slug: 'medical-ai', accentKey: 'medical', description: '医療分野におけるAI活用の最前線を扱います。' },
  { name: 'Development', slug: 'development', accentKey: 'development', description: 'AI開発の実践ログ・技術検証を記録します。' },
  { name: 'Weekly AI', slug: 'weekly', accentKey: 'weekly', description: '1週間のAI関連トピックをまとめてお届けします。' },
]

export function getCategoryBySlug(slug: string): CategoryInfo | undefined {
  return CATEGORIES.find((category) => category.slug === slug)
}

export function getCategoryByName(name: CategoryName): CategoryInfo {
  const category = CATEGORIES.find((category) => category.name === name)
  if (!category) {
    throw new Error(`未定義のカテゴリです: ${name}`)
  }
  return category
}

export const ARTICLES_PER_PAGE = 9

// TailwindはクラスをソースコードのJIT解析で検出するため、
// `text-accent-${key}` のような動的生成ではなく完全な文字列をここに列挙しておく
export const ACCENT_CLASSES: Record<CategoryInfo['accentKey'], { text: string; bg: string; border: string }> = {
  news: { text: 'text-accent-news', bg: 'bg-accent-news/10', border: 'border-accent-news' },
  agents: { text: 'text-accent-agents', bg: 'bg-accent-agents/10', border: 'border-accent-agents' },
  automation: { text: 'text-accent-automation', bg: 'bg-accent-automation/10', border: 'border-accent-automation' },
  medical: { text: 'text-accent-medical', bg: 'bg-accent-medical/10', border: 'border-accent-medical' },
  development: { text: 'text-accent-development', bg: 'bg-accent-development/10', border: 'border-accent-development' },
  weekly: { text: 'text-accent-weekly', bg: 'bg-accent-weekly/10', border: 'border-accent-weekly' },
}

// 記事frontmatterに`heroImage`が未指定の場合に使うカテゴリ別デフォルト画像。
// 実写真等に差し替える場合は、同じファイル名（拡張子込み）で public/images/categories/ を上書きするか、
// このマップのパスを新しいファイル名に変更する
export const CATEGORY_IMAGES: Record<CategoryInfo['accentKey'], string> = {
  news: '/images/categories/news.svg',
  agents: '/images/categories/agents.svg',
  automation: '/images/categories/automation.svg',
  medical: '/images/categories/medical-ai.svg',
  development: '/images/categories/development.svg',
  weekly: '/images/categories/weekly.svg',
}

/** 記事のheroImageが未指定のときに使う、カテゴリ別フォールバック画像のパスを返す */
export function getCategoryImage(category: CategoryInfo): string {
  return CATEGORY_IMAGES[category.accentKey]
}
