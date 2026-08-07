// data/ 配下のJSONファイル読み書きを共通化する

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import type { DraftManifestEntry, RunLog } from './types'

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = path.join(SRC_DIR, '..', 'data')
export const SEEN_PATH = path.join(DATA_DIR, 'seen.json')
export const LOGS_DIR = path.join(DATA_DIR, 'logs')
export const PENDING_DRAFTS_PATH = path.join(DATA_DIR, '.pending-drafts.json')
export const ARTICLES_DIR = path.join(SRC_DIR, '..', '..', '..', 'src', 'content', 'articles')

/** url -> 初回検知日時(ISO文字列) */
export type SeenMap = Record<string, string>

export async function loadSeen(): Promise<SeenMap> {
  try {
    const raw = await fs.readFile(SEEN_PATH, 'utf-8')
    return JSON.parse(raw) as SeenMap
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }
    throw error
  }
}

export async function saveSeen(seen: SeenMap): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(SEEN_PATH, JSON.stringify(seen, null, 2) + '\n', 'utf-8')
}

export async function saveRunLog(log: RunLog): Promise<void> {
  await fs.mkdir(LOGS_DIR, { recursive: true })
  const filePath = path.join(LOGS_DIR, `${log.date}.json`)
  await fs.writeFile(filePath, JSON.stringify(log, null, 2) + '\n', 'utf-8')
}

export async function savePendingDrafts(drafts: DraftManifestEntry[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(PENDING_DRAFTS_PATH, JSON.stringify(drafts, null, 2) + '\n', 'utf-8')
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
