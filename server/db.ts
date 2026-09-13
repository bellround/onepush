import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// 라운드 하나 = 한 행. 조작 순서(actions)만 JSON 문자열로, 나머지는 SQL로 바로 집계할 수 있게 컬럼.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    chapter TEXT NOT NULL,
    round INTEGER NOT NULL,
    level_id TEXT NOT NULL,
    level_index INTEGER NOT NULL,
    cleared INTEGER NOT NULL,
    clear_ms INTEGER,
    quit_ms INTEGER,
    advanced_after_clear INTEGER NOT NULL,
    reset_count INTEGER NOT NULL,
    undo_count INTEGER NOT NULL,
    first_move_ms INTEGER,
    max_gap_ms INTEGER,
    actions TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`

export function openDb(path = process.env.DB_PATH ?? 'data/rounds.db'): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  // WAL: 쓰는 동안(server insert)도 sqlite3 CLI로 조회/삭제 가능. busy_timeout: 잠깐 겹치면 에러 대신 대기.
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec(SCHEMA)
  return db
}

// --- 요청 본문 검증 (브라우저가 보내는 값이라 전부 신뢰하지 않는다) ---

const MAX_ACTIONS = 20000
const KINDS = new Set(['move', 'undo', 'reset'])
const DIRECTIONS = new Set(['up', 'down', 'left', 'right'])

function str(v: unknown, max: number): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) throw new Error(`bad string: ${String(v)}`)
  return v
}

function int(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1e12) throw new Error(`bad int: ${String(v)}`)
  return v
}

function intOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : int(v)
}

function bool(v: unknown): number {
  if (typeof v !== 'boolean') throw new Error(`bad bool: ${String(v)}`)
  return v ? 1 : 0
}

function actionsJson(v: unknown): string {
  if (!Array.isArray(v) || v.length > MAX_ACTIONS) throw new Error('bad actions')
  for (const a of v) {
    if (typeof a !== 'object' || a === null) throw new Error('bad action')
    const { kind, direction, t } = a as Record<string, unknown>
    if (!KINDS.has(kind as string)) throw new Error(`bad action kind: ${String(kind)}`)
    if (direction !== null && !DIRECTIONS.has(direction as string)) {
      throw new Error(`bad action direction: ${String(direction)}`)
    }
    int(t)
  }
  return JSON.stringify(v)
}

export function insertRound(db: DatabaseSync, body: unknown): void {
  if (typeof body !== 'object' || body === null) throw new Error('bad body')
  const b = body as Record<string, unknown>

  // 레벨 id "ch1-4" 에서 챕터/라운드를 뽑는다 — 클라이언트가 따로 보내지 않는다.
  const levelId = str(b.levelId, 20)
  const [chapter, round] = levelId.split('-')
  if (!/^ch\d+$/.test(chapter) || !/^\d+$/.test(round ?? '')) throw new Error(`bad levelId: ${levelId}`)

  db.prepare(
    `INSERT INTO rounds
       (session_id, chapter, round, level_id, level_index, cleared, clear_ms, quit_ms,
        advanced_after_clear, reset_count, undo_count, first_move_ms, max_gap_ms, actions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    str(b.sessionId, 64),
    chapter,
    Number(round),
    levelId,
    int(b.levelIndex),
    bool(b.cleared),
    intOrNull(b.clearMs),
    intOrNull(b.quitMs),
    bool(b.advancedAfterClear),
    int(b.resetCount),
    int(b.undoCount),
    intOrNull(b.firstMoveMs),
    intOrNull(b.maxGapMs),
    actionsJson(b.actions),
  )
}
