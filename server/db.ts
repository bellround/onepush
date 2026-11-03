import pg from 'pg'
import type { Pool } from 'pg'

// 라운드 하나 = 한 행. 조작 순서(actions)만 JSON 문자열로, 나머지는 SQL로 바로 집계할 수 있게 컬럼.
export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rounds (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    chapter TEXT NOT NULL,
    round DOUBLE PRECISION NOT NULL,
    level_id TEXT NOT NULL,
    level_index DOUBLE PRECISION NOT NULL,
    cleared BOOLEAN NOT NULL,
    clear_ms DOUBLE PRECISION,
    quit_ms DOUBLE PRECISION,
    advanced_after_clear BOOLEAN NOT NULL,
    reset_count DOUBLE PRECISION NOT NULL,
    undo_count DOUBLE PRECISION NOT NULL,
    first_move_ms DOUBLE PRECISION,
    max_gap_ms DOUBLE PRECISION,
    actions JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS round_imports (
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    round_id BIGINT NOT NULL REFERENCES rounds(id),
    PRIMARY KEY (source, source_id)
  );
  CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0)
  );
  CREATE TABLE IF NOT EXISTS player_sessions (
    token_hash TEXT PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS player_sessions_expiry ON player_sessions(expires_at);
  ALTER TABLE rounds ADD COLUMN IF NOT EXISTS username TEXT;
  -- 아이디는 대소문자·유니코드 정규화 차이를 무시하고 한 계정으로 본다 (맥 NFD / 윈도 NFC 혼용 방지).
  ALTER TABLE players ADD COLUMN IF NOT EXISTS username_key TEXT
    GENERATED ALWAYS AS (lower(normalize(username, NFC))) STORED;
  CREATE UNIQUE INDEX IF NOT EXISTS players_username_key_unique ON players (username_key);
`

export async function openDb(connectionString = process.env.DATABASE_URL): Promise<Pool> {
  if (!connectionString) throw new Error('DATABASE_URL required')
  const db = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 15000 })
  db.on('error', () => console.warn('Database connection unavailable'))
  try { await db.query(SCHEMA) } catch (error) {
    // username_key 유니크 인덱스는 정규화가 겹치는 기존 계정이 있으면 실패한다 — 조용히 합치지 않고 관리자가 직접 정리하게 알린다.
    const conflicts = await db.query(`SELECT string_agg(username, ' / ') AS names FROM players GROUP BY lower(normalize(username, NFC)) HAVING count(*) > 1`).catch(() => null)
    await db.end()
    const names: string[] = conflicts?.rows.map(row => row.names as string) ?? []
    throw names.length ? new Error(`아이디 정규화 충돌: ${names.join(', ')} — 한쪽 계정의 username을 바꾸거나 삭제한 뒤 다시 시작하세요.`, { cause: error }) : error
  }
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

function bool(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new Error(`bad bool: ${String(v)}`)
  return v
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

export function roundValues(body: unknown): unknown[] {
  if (typeof body !== 'object' || body === null) throw new Error('bad body')
  const b = body as Record<string, unknown>

  // 레벨 id "ch1-4" 에서 챕터/라운드를 뽑는다 — 클라이언트가 따로 보내지 않는다.
  const levelId = str(b.levelId, 20)
  const [chapter, round] = levelId.split('-')
  if (!/^ch\d+$/.test(chapter) || !/^\d+$/.test(round ?? '')) throw new Error(`bad levelId: ${levelId}`)

  return [
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
  ]
}

export const ROUND_COLUMNS = 'session_id, chapter, round, level_id, level_index, cleared, clear_ms, quit_ms, advanced_after_clear, reset_count, undo_count, first_move_ms, max_gap_ms, actions'
export const INSERT_ROUND = `INSERT INTO rounds (${ROUND_COLUMNS}) VALUES (${Array.from({ length: 14 }, (_, i) => `$${i + 1}`).join(', ')})`

export async function insertRound(db: Pick<Pool, 'query'>, body: unknown): Promise<void> {
  await db.query(INSERT_ROUND, roundValues(body))
}

export function pagination(params: URLSearchParams): { limit: number; beforeId: string | null } {
  const raw = params.get('limit') ?? '50'
  const beforeId = params.get('beforeId')
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 100) throw new Error('bad limit')
  if (beforeId !== null && (!/^[1-9]\d{0,18}$/.test(beforeId) || BigInt(beforeId) > 9223372036854775807n)) throw new Error('bad cursor')
  return { limit: Number(raw), beforeId }
}

export async function listRounds(db: Pick<Pool, 'query'>, page: ReturnType<typeof pagination>) {
  const result = await db.query(`SELECT rounds.id::text, ${ROUND_COLUMNS}, username, created_at FROM rounds WHERE ($1::bigint IS NULL OR rounds.id < $1::bigint) ORDER BY rounds.id DESC LIMIT $2`, [page.beforeId, page.limit + 1])
  const hasMore = result.rows.length > page.limit
  const rows = result.rows.slice(0, page.limit).map(row => ({ ...row, created_at: new Date(row.created_at).toISOString() }))
  return { rows, hasMore, nextBeforeId: hasMore ? rows.at(-1)!.id as string : null }
}

export async function exportDb(db: Pick<Pool, 'query'>) {
  // One statement shares a snapshot; text overrides avoid bigint and timestamp precision loss.
  const result = await db.query(`SELECT
    COALESCE((SELECT jsonb_agg(to_jsonb(r) || jsonb_build_object('id', r.id::text, 'created_at', r.created_at::text) ORDER BY r.id) FROM rounds r), '[]'::jsonb) AS rounds,
    COALESCE((SELECT jsonb_agg(to_jsonb(i) || jsonb_build_object('round_id', i.round_id::text) ORDER BY i.source, i.source_id) FROM round_imports i), '[]'::jsonb) AS round_imports`)
  return { formatVersion: 1, exportedAt: new Date().toISOString(), ...result.rows[0] }
}
