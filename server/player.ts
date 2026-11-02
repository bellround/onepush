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

export function credentials(body: unknown): { username: string; password: string } {
  const { username, password } = (body ?? {}) as Record<string, unknown>
  if (typeof username !== 'string' || !/^[\p{L}\p{N}_-]{1,32}$/u.test(username) ||
      typeof password !== 'string' || password.length < 1 || password.length > 128 || Buffer.byteLength(password) > 512) {
    throw new Error('invalid credentials')
  }
  return { username, password }
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

export async function enterPlayer(db: Db, username: string, password: string): Promise<Player | null> {
  let result = await db.query('SELECT id::text, username, progress, password_hash FROM players WHERE username = $1', [username])
  if (!result.rows.length) {
    const hash = await hashPassword(password)
    result = await db.query(`INSERT INTO players (username, password_hash) VALUES ($1, $2)
      ON CONFLICT (username) DO NOTHING RETURNING id::text, username, progress, password_hash`, [username, hash])
    // A concurrent registration must authenticate against the winning password.
    if (!result.rows.length) result = await db.query('SELECT id::text, username, progress, password_hash FROM players WHERE username = $1', [username])
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

export function createPlayerLimiter(now = Date.now) {
  const attempts = new Map<string, { count: number; until: number }>()
  let active = 0
  return {
    acquire(address: string): boolean {
      for (const [key, value] of attempts) if (value.until <= now()) attempts.delete(key)
      const entry = attempts.get(address) ?? { count: 0, until: now() + 60_000 }
      if (entry.count >= 10 || active >= 4 || (!attempts.has(address) && attempts.size >= 10000)) return false
      entry.count++
      attempts.set(address, entry)
      active++
      return true
    },
    release() { active-- },
  }
}
