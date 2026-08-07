// 日本語記事向けの読了時間算出ユーティリティ
// 英語の「単語数 ÷ 200語/分」のような計算は日本語には適さないため、
// Markdown記法を除去した本文の文字数を目安の速読速度（約500文字/分）で割って概算する

const AVERAGE_CHARS_PER_MINUTE = 500

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '') // コードブロック
    .replace(/`[^`]*`/g, '') // インラインコード
    .replace(/!\[.*?\]\(.*?\)/g, '') // 画像
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // リンク（テキストのみ残す）
    .replace(/^#{1,6}\s+/gm, '') // 見出し記号
    .replace(/[*_>#-]/g, '') // 装飾記号
    .replace(/\s+/g, '')
}

export function calculateReadingTime(markdown: string): number {
  const charCount = stripMarkdown(markdown).length
  return Math.max(1, Math.ceil(charCount / AVERAGE_CHARS_PER_MINUTE))
}
