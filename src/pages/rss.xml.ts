import type { APIRoute } from 'astro'
import { getPublishedArticles, getArticleUrl } from '../utils/articles'
import { SITE_TITLE, SITE_DESCRIPTION, SITE_URL } from '../consts'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const GET: APIRoute = async () => {
  const articles = await getPublishedArticles()

  const items = articles
    .map((article) => {
      const url = new URL(getArticleUrl(article), SITE_URL).href
      return `
    <item>
      <title>${escapeXml(article.data.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <description>${escapeXml(article.data.description)}</description>
      <pubDate>${article.data.publishDate.toUTCString()}</pubDate>
      <category>${escapeXml(article.data.category)}</category>
    </item>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ja</language>${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
