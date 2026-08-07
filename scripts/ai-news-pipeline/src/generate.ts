// スコア上位の候補をClaude(Sonnet)で構造化生成し、記事Markdown下書きとして書き出す

import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { GENERATION_MODEL, requestJson } from './claude-client'
import { ARTICLES_DIR } from './storage'
import { CATEGORIES } from '../../../src/consts'
import type { DraftManifestEntry, GeneratedArticle, PipelineError, ScoredItem } from './types'

// src/content/config.ts の articles コレクションスキーマと同期させること（フィールド追加時は両方更新する）
const articleFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  publishDate: z.coerce.date(),
  category: z.enum(['News', 'AI Agents', 'Automation', 'Medical AI', 'Development', 'Weekly AI']),
  tags: z.array(z.string()).min(1),
  // マージ＝即公開の運用にするため、下書きの段階からdraft: falseで生成する。
  // 公開前レビューの歯止めはPRのマージという人間の操作そのものが担う
  draft: z.literal(false),
  author: z.string().min(1),
})

const SYSTEM_PROMPT = `あなたはAIメディア「KusaBase AI Lab」の編集記者です。与えられたAIニュース1件をもとに、記事下書きをJSON形式のみで出力してください（説明文やコードフェンスは不要です）。

厳守事項:
- 単なる翻訳・要約の転載は禁止。必ず"kusabasePerspective"にKusaBase編集部独自の考察・視点を書くこと（ニュース転載サイト化を避ける）
- categoryは次のいずれか1つを選ぶこと（括弧内は説明）:
${CATEGORIES.map((c) => `  - ${c.name}（${c.description}）`).join('\n')}
- slugは英数字とハイフンのみのkebab-case（日本語不可、例: "claude-code-mcp-update"）
- tagsは3〜6個、日本語可
- 各sectionは見出し記号(#)を含めず、本文のみをプレーンテキストで書くこと（見出しはシステム側で付与する）

出力JSON形式:
{
  "title": "",
  "description": "",
  "category": "",
  "tags": [""],
  "slug": "",
  "sections": {
    "summary": "ニュース概要",
    "whatChanged": "何が変わったか",
    "developerImpact": "開発者への影響",
    "kusabasePerspective": "KusaBase視点の考察",
    "forecast": "今後の予測"
  }
}`

function buildUserPrompt(scored: ScoredItem): string {
  const { item, score } = scored
  return `ソース: ${item.sourceName}\nタイトル: ${item.title}\nURL: ${item.url}\n公開日時: ${item.publishedAt}\n概要: ${item.summary || '(概要なし)'}\n重要度スコア: ${score.overallScore}（根拠: ${score.reasoning}）`
}

function sanitizeSlug(rawSlug: string): string {
  const slug = rawSlug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'ai-news-draft'
}

async function resolveUniqueFilename(dateStr: string, slug: string, usedInThisRun: Set<string>): Promise<string> {
  let candidate = `${dateStr}-${slug}`
  let suffix = 2
  while (true) {
    const filename = `${candidate}.md`
    const alreadyUsed = usedInThisRun.has(filename)
    const existsOnDisk = await fs
      .access(path.join(ARTICLES_DIR, filename))
      .then(() => true)
      .catch(() => false)
    if (!alreadyUsed && !existsOnDisk) {
      usedInThisRun.add(filename)
      return filename
    }
    candidate = `${dateStr}-${slug}-${suffix}`
    suffix += 1
  }
}

function buildMarkdown(article: GeneratedArticle, frontmatter: z.infer<typeof articleFrontmatterSchema>, sourceUrl: string, sourceName: string): string {
  const tagsYaml = frontmatter.tags.map((tag) => `"${tag}"`).join(', ')
  const publishDateStr = frontmatter.publishDate.toISOString().slice(0, 10)

  return `---
title: "${frontmatter.title.replace(/"/g, '\\"')}"
description: "${frontmatter.description.replace(/"/g, '\\"')}"
publishDate: ${publishDateStr}
category: "${frontmatter.category}"
tags: [${tagsYaml}]
draft: false
author: "${frontmatter.author}"
---

*出典: [${sourceName}](${sourceUrl})*

## ニュース概要

${article.sections.summary}

## 何が変わったか

${article.sections.whatChanged}

## 開発者への影響

${article.sections.developerImpact}

## KusaBase視点の考察

${article.sections.kusabasePerspective}

## 今後の予測

${article.sections.forecast}
`
}

export interface GenerateOutput {
  drafts: DraftManifestEntry[]
  errors: PipelineError[]
  validationFailedTitles: string[]
}

export async function generateDrafts(candidates: ScoredItem[]): Promise<GenerateOutput> {
  const errors: PipelineError[] = []
  const drafts: DraftManifestEntry[] = []
  const validationFailedTitles: string[] = []
  const usedFilenames = new Set<string>()
  const today = new Date().toISOString().slice(0, 10)

  await fs.mkdir(ARTICLES_DIR, { recursive: true })

  for (const scored of candidates) {
    try {
      const generated = await requestJson<GeneratedArticle>(GENERATION_MODEL, SYSTEM_PROMPT, buildUserPrompt(scored))

      const frontmatter = articleFrontmatterSchema.parse({
        title: generated.title,
        description: generated.description,
        publishDate: today,
        category: generated.category,
        tags: generated.tags,
        draft: false,
        // マージした時点で公開扱いになるため、既存記事と同じ通常の著者名にする
        // （「要レビュー」等の内部向け注記はPR上でのみ扱い、公開ページには出さない）
        author: 'KusaBase AI Lab編集部',
      })

      const slug = sanitizeSlug(generated.slug)
      const filename = await resolveUniqueFilename(today, slug, usedFilenames)
      const markdown = buildMarkdown(generated, frontmatter, scored.item.url, scored.item.sourceName)

      await fs.writeFile(path.join(ARTICLES_DIR, filename), markdown, 'utf-8')

      drafts.push({
        filePath: `src/content/articles/${filename}`,
        title: frontmatter.title,
        slug,
        branch: `ai-news-draft/${slug}`,
        overallScore: scored.score.overallScore,
        sourceUrl: scored.item.url,
        sourceName: scored.item.sourceName,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        validationFailedTitles.push(scored.item.title)
        errors.push({
          step: 'generate',
          sourceId: scored.item.sourceId,
          message: `[${scored.item.title}] frontmatterバリデーション失敗: ${error.message}`,
        })
      } else {
        errors.push({
          step: 'generate',
          sourceId: scored.item.sourceId,
          message: `[${scored.item.title}] ${(error as Error).message}`,
        })
      }
    }
  }

  return { drafts, errors, validationFailedTitles }
}
