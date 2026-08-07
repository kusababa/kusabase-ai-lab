/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
      },
      colors: {
        // ベース背景色（アイボリー系）。数字が大きいほど濃くなる
        ivory: {
          50: '#FEFDFB',
          100: '#FAF8F4',
          200: '#F5F1E9',
          300: '#EDE6D8',
          400: '#E0D6C0',
        },
        // サーフェス・ボーダー用（グレージュ系）
        greige: {
          100: '#EFEAE0',
          200: '#E3DBCB',
          300: '#D4C8B4',
          400: '#B8A88E',
          500: '#9C8A6E',
        },
        // 本文・見出しテキスト用（グレースケール寄りのチャコール系）
        charcoal: {
          300: '#A69E8F',
          500: '#736C60',
          700: '#4A453D',
          900: '#2B2823',
        },
        // カテゴリ別アクセント。低彩度・使用箇所は境界線/薄い背景/バッジ等に限定する
        accent: {
          news: '#8C7355',
          agents: '#5B7B8C',
          automation: '#6B7F5B',
          medical: '#7A6B8C',
          development: '#5B6B8C',
          weekly: '#8C5B6B',
        },
      },
      spacing: {
        section: '6rem',
      },
    },
  },
  plugins: [],
}
