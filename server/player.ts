import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { Pool } from 'pg'

type Db = Pick<Pool, 'query'>
export type Player = { id: string; username: string; progress: number }
const TTL = 30 * 24 * 60 * 60
const COOKIE = 'ion_player'
const digest = (token: string) => createHash('sha256').update(token).digest('hex')
const derive = (password: string, salt: string): Promise<Buffer> => new Promise((resolve, reject) => {
  scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key))
})

// 조회 키 — DB의 username_key 생성 컬럼(lower(normalize(username, NFC)))과 같은 뜻. 레이트리밋 키로만 쓴다.
export const usernameKey = (username: string) => username.normalize('NFC').toLowerCase()

export function credentials(body: unknown): { username: string; password: string } {
  const { username, password } = (body ?? {}) as Record<string, unknown>
  const name = typeof username === 'string' ? username.normalize('NFC') : username
  if (typeof name !== 'string' || !/^[\p{L}\p{N}]{1,32}$/u.test(name) ||
      typeof password !== 'string' || password.length < 1 || password.length > 128 || Buffer.byteLength(password) > 512) {
    throw new Error('invalid credentials')
  }
  return { username: name, password }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${(await derive(password, salt)).toString('hex')}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':')
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(key ?? '')) return false
  return timingSafeEqual(await derive(password, salt), Buffer.from(key, 'hex'))
}

export function sessionToken(req: IncomingMessage): string | null {
  const token = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null
}

export function playerCookie(token: string, base: string, secure: boolean, clear = false): string {
  return `${COOKIE}=${token}; Path=${base || '/'}; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : TTL}${secure ? '; Secure' : ''}`
}

export async function getPlayer(db: Db, req: IncomingMessage): Promise<Player | null> {
  const token = sessionToken(req)
  if (!token) return null
  const result = await db.query(`SELECT p.id::text, p.username, p.progress FROM players p
    JOIN player_sessions s ON s.player_id = p.id WHERE s.token_hash = $1 AND s.expires_at > now()`, [digest(token)])
  return result.rows[0] ?? null
}

export async function revokeSession(db: Db, req: IncomingMessage): Promise<void> {
  const token = sessionToken(req)
  if (token) await db.query('DELETE FROM player_sessions WHERE token_hash = $1', [digest(token)])
}

const FIND_PLAYER = 'SELECT id::text, username, progress, password_hash FROM players WHERE username_key = lower(normalize($1, NFC))'

// 최소 길이는 신규 가입에만 적용한다 — 이미 짧은 비밀번호로 가입한 계정을 잠그지 않는다.
export async function enterPlayer(db: Db, username: string, password: string): Promise<Player | 'weak-password' | null> {
  let result = await db.query(FIND_PLAYER, [username])
  if (!result.rows.length) {
    if (password.length < 4) return 'weak-password'
    const hash = await hashPassword(password)
    // 대상 없는 ON CONFLICT — username과 username_key 유니크 제약 양쪽을 모두 받는다.
    result = await db.query(`INSERT INTO players (username, password_hash) VALUES ($1, $2)
      ON CONFLICT DO NOTHING RETURNING id::text, username, progress, password_hash`, [username, hash])
    // A concurrent registration must authenticate against the winning password.
    if (!result.rows.length) result = await db.query(FIND_PLAYER, [username])
  }
  const player = result.rows[0]
  return player && await verifyPassword(password, player.password_hash) ? { id: player.id, username: player.username, progress: player.progress } : null
}

export async function newSession(db: Db, player: Player): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await db.query('DELETE FROM player_sessions WHERE expires_at <= now()')
  await db.query(`INSERT INTO player_sessions (token_hash, player_id, expires_at) VALUES ($1, $2, now() + interval '30 days')`, [digest(token), player.id])
  return token
}

export async function saveProgress(db: Db, player: Player, index: number): Promise<Player | null> {
  const result = await db.query(`UPDATE players SET progress = GREATEST(progress, $2::integer + 1)
    WHERE id = $1 AND progress >= $2::integer RETURNING id::text, username, progress`, [player.id, index])
  return result.rows[0] ?? null
}

// 게스트 진행도 승계 — 뒤로 가지 않게 GREATEST. 상한은 호출자가 카탈로그 길이로 건다.
export async function inheritProgress(db: Db, player: Player, progress: number): Promise<Player> {
  const result = await db.query(`UPDATE players SET progress = GREATEST(progress, $2::integer)
    WHERE id = $1 RETURNING id::text, username, progress`, [player.id, progress])
  return result.rows[0] ?? player
}

export async function verifyPlayerPassword(db: Db, player: Player, password: string): Promise<boolean> {
  const result = await db.query('SELECT password_hash FROM players WHERE id = $1', [player.id])
  const hash = result.rows[0]?.password_hash
  return typeof hash === 'string' && await verifyPassword(password, hash)
}

export async function resetProgress(db: Db, player: Player): Promise<Player> {
  const result = await db.query('UPDATE players SET progress = 0 WHERE id = $1 RETURNING id::text, username, progress', [player.id])
  return result.rows[0] ?? player
}

type Window = { count: number; until: number }

// 창은 슬라이딩이 아니라 첫 시도 시점부터 고정 60초다 — 그 전제로 상한을 잡았다.
function hit(windows: Map<string, Window>, key: string, max: number, now: number): boolean {
  for (const [stale, value] of windows) if (value.until <= now) windows.delete(stale)
  const entry = windows.get(key) ?? { count: 0, until: now + 60_000 }
  if (entry.count >= max || (!windows.has(key) && windows.size >= 10000)) return false
  entry.count++
  windows.set(key, entry)
  return true
}

export function createPlayerLimiter(now = Date.now) {
  const byAddress = new Map<string, Window>()
  const byUsername = new Map<string, Window>()
  let active = 0
  return {
    // 아이디당 상한이 단일 계정 브루트포스 방어선. IP당 상한은 교실 NAT 공유 IP 때문에 느슨하다.
    acquire(address: string, usernameKey: string): boolean {
      if (active >= 8 || !hit(byUsername, usernameKey, 10, now())) return false
      if (!hit(byAddress, address, 60, now())) return false
      active++
      return true
    },
    release() { active-- },
  }
}
