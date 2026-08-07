import { defineConfig } from 'astro/config'
import tailwind from '@astrojs/tailwind'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://ai.kusabase.com',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap(),
  ],
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    shikiConfig: {
      // アイボリー系デザインに馴染む落ち着いたシンタックスハイライトテーマ
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
})
