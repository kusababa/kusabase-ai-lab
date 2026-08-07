// ローカル専用の簡易ダッシュボードサーバー。追加パッケージ不要（Node標準モジュールのみ）。
// 127.0.0.1のみでlistenし、認証は実装しない（ローカル利用前提のため）。

import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DASHBOARD_DIR = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(DASHBOARD_DIR, '..', '..', 'data')
const LOGS_DIR = path.join(DATA_DIR, 'logs')
const INDEX_HTML_PATH = path.join(DASHBOARD_DIR, 'index.html')
const PORT = 4322
const HOST = '127.0.0.1'

async function loadLogs() {
  let filenames = []
  try {
    filenames = (await fs.readdir(LOGS_DIR)).filter((name) => name.endsWith('.json'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return []
  }

  const logs = await Promise.all(
    filenames.map(async (filename) => {
      const raw = await fs.readFile(path.join(LOGS_DIR, filename), 'utf-8')
      return JSON.parse(raw)
    }),
  )

  return logs.sort((a, b) => (a.date < b.date ? 1 : -1))
}

async function handleSummary(res) {
  const logs = await loadLogs()
  const today = new Date().toISOString().slice(0, 10)
  const todayLog = logs.find((log) => log.date === today) ?? null

  const body = JSON.stringify({
    today,
    todayLog,
    recentLogs: logs.slice(0, 14),
  })

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(body)
}

async function handleIndex(res) {
  const html = await fs.readFile(INDEX_HTML_PATH, 'utf-8')
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`)
    if (url.pathname === '/api/summary') {
      await handleSummary(res)
    } else if (url.pathname === '/') {
      await handleIndex(res)
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not Found')
    }
  } catch (error) {
    console.error(error)
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Internal Server Error')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`AI News Pipeline ダッシュボード: http://${HOST}:${PORT} （Ctrl+Cで終了）`)
})
