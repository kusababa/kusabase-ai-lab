// ニュース収集元の定義。
// URLは実装時に curl でHTTPステータスを確認済み（2026-08-07時点）。
// enabled: false のソースは、フィードが存在しない/bot対策で自動取得できないことを確認したもの。
// 将来的にHTMLスクレイピング等の別実装を追加する余地として残してある。

import type { NewsSource } from './types'

export const NEWS_SOURCES: NewsSource[] = [
  // ---- 優先度高 ----
  {
    id: 'openai-news',
    name: 'OpenAI',
    tier: 'high',
    type: 'rss',
    url: 'https://openai.com/news/rss.xml',
    enabled: true,
  },
  {
    id: 'anthropic-news',
    name: 'Anthropic',
    tier: 'high',
    type: 'rss',
    url: 'https://www.anthropic.com/news/rss.xml',
    enabled: false,
    note: '公式RSSフィードが未提供（404を確認）。将来的にHTMLスクレイピング対応を検討',
  },
  {
    id: 'google-ai-blog',
    name: 'Google AI',
    tier: 'high',
    type: 'rss',
    url: 'https://blog.google/technology/ai/rss/',
    enabled: true,
  },
  {
    id: 'xai-blog',
    name: 'xAI',
    tier: 'high',
    type: 'rss',
    url: 'https://x.ai/blog/rss.xml',
    enabled: false,
    note: 'bot対策と思われる403応答を確認。GitHub Actionsからのアクセス可否を別途要検証',
  },
  {
    id: 'cursor-changelog',
    name: 'Cursor',
    tier: 'high',
    type: 'rss',
    url: 'https://cursor.com/changelog/rss.xml',
    enabled: true,
  },
  {
    id: 'claude-code-releases',
    name: 'Claude Code',
    tier: 'high',
    type: 'github-releases',
    url: 'https://github.com/anthropics/claude-code/releases.atom',
    enabled: true,
  },
  {
    id: 'github-trending-ai',
    name: 'GitHub Trending AI（近似）',
    tier: 'high',
    type: 'github-search',
    // 公式のTrendingフィードは存在しないため、直近作成でスター数が伸びているAI関連リポジトリを近似値として使う
    url: 'https://api.github.com/search/repositories?q=topic:ai+created:%3E{since}&sort=stars&order=desc&per_page=10',
    enabled: true,
    note: 'GitHub公式Trendingページの近似（topic:ai を条件にした直近作成リポジトリのスター数ソート）',
  },

  // ---- 優先度中 ----
  {
    id: 'huggingface-blog',
    name: 'Hugging Face',
    tier: 'mid',
    type: 'rss',
    url: 'https://huggingface.co/blog/feed.xml',
    enabled: true,
  },
  {
    id: 'langchain-blog',
    name: 'LangChain',
    tier: 'mid',
    type: 'rss',
    url: 'https://blog.langchain.dev/rss/',
    enabled: true,
  },
  {
    id: 'n8n-blog',
    name: 'n8n',
    tier: 'mid',
    type: 'rss',
    url: 'https://blog.n8n.io/rss/',
    enabled: true,
  },
  {
    id: 'mcp-servers-releases',
    name: 'MCP (modelcontextprotocol/servers)',
    tier: 'mid',
    type: 'github-releases',
    url: 'https://github.com/modelcontextprotocol/servers/releases.atom',
    enabled: true,
  },
]
