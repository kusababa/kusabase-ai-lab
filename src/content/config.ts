import { defineCollection, z } from 'astro:content'

const articles = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['News', 'AI Agents', 'Automation', 'Medical AI', 'Development', 'Weekly AI']),
    tags: z.array(z.string()).optional().default([]),
    draft: z.boolean().optional().default(false),
    // トップページの「Featured Articles」に表示するかどうか
    featured: z.boolean().optional().default(false),
    // トップページの「Popular Articles」に表示するかどうか（アクセス解析がない静的サイトのため手動指定）
    popular: z.boolean().optional().default(false),
    heroImage: z.string().optional(),
    author: z.string().optional().default('KusaBase AI Lab編集部'),
  }),
})

export const collections = { articles }
