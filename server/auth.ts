import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

const TTL = 8 * 60 * 60 * 1000
const digest = (value: string) => createHash('sha256').update(value).digest()

export function createAuth(password: string, now = Date.now) {
  if (!password) throw new Error('ADMIN_PASSWORD required')
  const expected = digest(password)
  const sessions = new Map<string, number>()
  function token(req: IncomingMessage) {
    return /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1]
  }
  function clean() {
    for (const [key, expires] of sessions) if (expires <= now()) sessions.delete(key)
  }
  return {
    allowed(req: IncomingMessage) {
      clean()
      return sessions.has(token(req) ?? '')
    },
    login(req: IncomingMessage, value: unknown): { status: number; token?: string } {
      clean()
      if (typeof value !== 'string' || value.length > 4096 || !timingSafeEqual(digest(value), expected)) return { status: 401 }
      if (sessions.size >= 1000) return { status: 503 }
      sessions.delete(token(req) ?? '')
      const id = randomBytes(32).toString('hex')
      sessions.set(id, now() + TTL)
      return { status: 200, token: id }
    },
    logout(req: IncomingMessage) {
      sessions.delete(token(req) ?? '')
    },
  }
}

export function sameOrigin(req: IncomingMessage, publicOrigin?: string): boolean {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (!origin) return req.method === 'GET'
  try {
    const expected = publicOrigin ?? `http://${req.headers.host}`
    return new URL(origin).origin === new URL(expected).origin
  } catch { return false }
}
