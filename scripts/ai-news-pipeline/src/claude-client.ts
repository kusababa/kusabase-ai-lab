// Anthropic SDKの共通ラッパー。モデル名をこのファイルに集約する。

import Anthropic from '@anthropic-ai/sdk'

// スコアリングは軽量タスクのためHaiku、記事生成は品質重視でSonnetを使う
export const SCORING_MODEL = 'claude-haiku-4-5-20251001'
export const GENERATION_MODEL = 'claude-sonnet-5'

let client: Anthropic | undefined

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('環境変数 ANTHROPIC_API_KEY が設定されていません')
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

/**
 * JSON形式での応答を要求するプロンプトをClaudeへ送信し、パース済みオブジェクトを返す。
 * 応答が```json フェンスで囲まれる場合があるため、パース前に取り除く。
 */
export async function requestJson<T>(model: string, systemPrompt: string, userPrompt: string, maxTokens = 2048): Promise<T> {
  const response = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claudeからテキスト応答が得られませんでした')
  }

  const jsonText = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')

  try {
    return JSON.parse(jsonText) as T
  } catch (error) {
    throw new Error(`Claudeの応答をJSONとして解析できませんでした: ${(error as Error).message}`)
  }
}
