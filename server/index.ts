import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Pool } from 'pg'
import { exportDb, listRounds, openDb, pagination, roundIdentity, roundValues, saveRound } from './db.ts'
import { createAuth, sameOrigin } from './auth.ts'
import { injectConfig, normalizeBase } from './platform.ts'
import { loadCatalog } from './catalog.ts'
import { createPlayerLimiter, credentials, enterPlayer, getPlayer, inheritProgress, newSession, playerCookie, resetProgress, revokeSession, saveProgress, usernameKey, verifyPlayerPassword } from './player.ts'

const DIST = resolve(import.meta.dirname, '../dist')
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }

async function readBody(req: IncomingMessage, max = 2_000_000): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  let tooLarge = false
  for await (const chunk of req) {
    size += chunk.length
    if (size > max) tooLarge = true
    if (!tooLarge) chunks.push(chunk as Buffer)
  }
  if (tooLarge) throw new RangeError('body too large')
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(value))
}

export function createApp(db: Pick<Pool, 'query'>, options: { basePath?: string; password: string; production?: boolean; publicOrigin?: string; dist?: string; levelIds?: string[] }) {
  const base = normalizeBase(options.basePath)
  const auth = createAuth(options.password)
  const limiter = createPlayerLimiter()
  const catalog = options.levelIds ? Promise.resolve(options.levelIds) : loadCatalog()
  // Observe startup catalog errors even before the first progress request.
  void catalog.catch(() => {})
  if (options.production && !options.publicOrigin) throw new Error('PUBLIC_ORIGIN required in production')
  const dist = options.dist ?? DIST
  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://internal')
      let path = url.pathname
      if (base && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length) || '/'
      if (path === '/irdmin' || path.startsWith('/irdmin/') || path.startsWith('/api/admin/')) {
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Content-Security-Policy', "frame-ancestors 'none'")
        res.setHeader('X-Frame-Options', 'DENY')
      }
      if (path === '/api' || path.startsWith('/api/')) {
        if (path.startsWith('/api/account')) {
          res.setHeader('Cache-Control', 'no-store')
          if (req.method !== 'GET' && !sameOrigin(req, options.publicOrigin)) return json(res, 403, { error: '요청 출처를 확인할 수 없습니다.' })
          const secure = !!options.production || options.publicOrigin?.startsWith('https:') === true
          try {
            if (path === '/api/account/enter' && req.method === 'POST') {
              let body, input
              try { body = await readBody(req, 4096); input = credentials(body) } catch { return json(res, 400, { error: '이름은 문자·숫자 1~32자, 비밀번호는 1~128자로 입력해 주세요.' }) }
              const guest = (body as { guestProgress?: unknown } | null)?.guestProgress
              if (guest !== undefined && (typeof guest !== 'number' || !Number.isInteger(guest) || guest < 0)) return json(res, 400, { error: '게스트 진행도가 올바르지 않습니다.' })
              if (!limiter.acquire(req.socket.remoteAddress ?? 'unknown', usernameKey(input.username))) return json(res, 429, { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' })
              try {
                const entered = await enterPlayer(db, input.username, input.password)
                if (entered === 'weak-password') return json(res, 400, { error: '비밀번호는 4자 이상으로 만들어 주세요.' })
                if (!entered) return json(res, 401, { error: '비밀번호가 올바르지 않습니다.' })
                // 조작된 localStorage가 없는 스테이지를 해금하지 못하게 카탈로그 길이로 상한을 건다.
                const player = guest ? await inheritProgress(db, entered, Math.min(guest, (await catalog).length)) : entered
                await revokeSession(db, req)
                const token = await newSession(db, player)
                res.setHeader('Set-Cookie', playerCookie(token, base, secure))
                return json(res, 200, { username: player.username, progress: player.progress })
              } finally { limiter.release() }
            }
            if (path === '/api/account/logout' && req.method === 'POST') {
              await revokeSession(db, req)
              res.setHeader('Set-Cookie', playerCookie('', base, secure, true))
              return res.writeHead(204).end()
            }
            if (path === '/api/account' && req.method === 'GET') {
              const player = await getPlayer(db, req)
              return player ? json(res, 200, { username: player.username, progress: player.progress }) : json(res, 401, { error: '로그인이 필요합니다.' })
            }
            if (path === '/api/account/reset' && req.method === 'POST') {
              const player = await getPlayer(db, req)
              if (!player) return json(res, 401, { error: '다시 로그인해 주세요.' })
              let body
              try { body = await readBody(req, 4096) } catch { return json(res, 400, { error: '비밀번호를 입력해 주세요.' }) }
              const password = (body as { password?: unknown } | null)?.password
              if (typeof password !== 'string' || !password || password.length > 128) return json(res, 400, { error: '비밀번호를 입력해 주세요.' })
              if (!limiter.acquire(req.socket.remoteAddress ?? 'unknown', usernameKey(player.username))) return json(res, 429, { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' })
              try {
                // 공유 PC에서 남이 눌러버리는 것을 막는 유일한 장치 — 비밀번호 재확인은 생략할 수 없다.
                if (!await verifyPlayerPassword(db, player, password)) return json(res, 401, { error: '비밀번호가 올바르지 않습니다.' })
                const reset = await resetProgress(db, player)
                return json(res, 200, { username: reset.username, progress: reset.progress })
              } finally { limiter.release() }
            }
            if (path === '/api/account/progress' && req.method === 'POST') {
              const player = await getPlayer(db, req)
              if (!player) return json(res, 401, { error: '다시 로그인해 주세요.' })
              let body
              try { body = await readBody(req, 4096) } catch { return json(res, 400, { error: '올바르지 않은 스테이지입니다.' }) }
              const expectedUsername = (body as { expectedUsername?: unknown } | null)?.expectedUsername
              if (typeof expectedUsername !== 'string' || !expectedUsername) return json(res, 400, { error: '계정 확인 정보가 필요합니다.' })
              if (expectedUsername !== player.username) return json(res, 409, { error: '계정이 변경되었습니다. 다시 로그인해 주세요.' })
              const id = (body as { levelId?: unknown } | null)?.levelId
              const index = typeof id === 'string' ? (await catalog).indexOf(id) : -1
              if (index < 0) return json(res, 400, { error: '올바르지 않은 스테이지입니다.' })
              const saved = await saveProgress(db, player, index)
              if (!saved) return json(res, 409, { error: '아직 열리지 않은 스테이지입니다.' })
              return json(res, 200, { username: saved.username, progress: saved.progress })
            }
          } catch { return json(res, 503, { error: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' }) }
          return json(res, 404, { error: '요청을 찾을 수 없습니다.' })
        }
        if (path.startsWith('/api/admin/')) {
          res.setHeader('Cache-Control', 'no-store')
          if (!sameOrigin(req, options.publicOrigin)) return json(res, 403, { error: 'Forbidden' })
          if (path === '/api/admin/login' && req.method === 'POST') {
            let body
            try { body = await readBody(req, 4096) } catch (error) { return json(res, error instanceof RangeError ? 413 : 400, { error: 'Invalid body' }) }
            const result = auth.login(req, (body as { password?: unknown } | null)?.password)
            if (result.status === 200) return json(res, 200, { token: result.token })
            return json(res, result.status, { error: 'Login unavailable or denied' })
          }
          if (path === '/api/admin/logout' && req.method === 'POST') {
            if (!auth.allowed(req)) return json(res, 401, { error: 'Unauthorized' })
            auth.logout(req)
            return res.writeHead(204).end()
          }
          if (path === '/api/admin/export' && req.method === 'GET') {
            if (!auth.allowed(req)) return json(res, 401, { error: 'Unauthorized' })
            let data
            try { data = await exportDb(db) } catch { return json(res, 503, { error: 'Database unavailable' }) }
            res.setHeader('Content-Disposition', `attachment; filename="ion-puzzle-db-${data.exportedAt.slice(0, 10)}.json"`)
            return json(res, 200, data)
          }
          if (path === '/api/admin/rounds' && req.method === 'GET') {
            if (!auth.allowed(req)) return json(res, 401, { error: 'Unauthorized' })
            let page
            try { page = pagination(url.searchParams) } catch { return json(res, 400, { error: 'Invalid pagination' }) }
            try { return json(res, 200, await listRounds(db, page)) } catch { return json(res, 503, { error: 'Database unavailable' }) }
          }
        }
        if (path === '/api/rounds' && req.method === 'POST') {
          if (!sameOrigin(req, options.publicOrigin)) return json(res, 403, { error: 'Forbidden' })
          let body, identity
          try {
            body = await readBody(req)
            identity = roundIdentity(body)
          } catch (error) { return json(res, error instanceof RangeError ? 413 : 400, { error: 'Invalid round' }) }
          let username: string | null = null
          if (identity.owner?.kind !== 'guest') {
            let player
            try { player = await getPlayer(db, req) } catch { return json(res, 503, { error: 'Database unavailable' }) }
            if (!player) return json(res, 401, { error: 'Unauthorized' })
            const expectedUsername = identity.owner?.expectedUsername ?? (body as { expectedUsername?: unknown }).expectedUsername
            if (typeof expectedUsername !== 'string' || !expectedUsername) return json(res, 400, { error: 'Expected account required' })
            if (expectedUsername !== player.username) return json(res, 409, { error: 'Account changed' })
            username = player.username
          }
          let values
          try { values = roundValues(body) } catch { return json(res, 400, { error: 'Invalid round' }) }
          try { await saveRound(db, values, identity, username) } catch { return json(res, 503, { error: 'Database unavailable' }) }
          return res.writeHead(204).end()
        }
        return json(res, 404, { error: 'Not found' })
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end()
      let decoded
      try { decoded = decodeURIComponent(path) } catch { return res.writeHead(400).end() }
      const target = resolve(dist, `.${decoded}`)
      let data: Buffer | string
      let type = TYPES['.html']
      try {
        if (!target.startsWith(dist + sep) || extname(target) === '.html') throw new Error('SPA')
        data = await readFile(target)
        type = TYPES[extname(target)] ?? 'application/octet-stream'
      } catch {
        if (extname(path) && !path.endsWith('.html')) return res.writeHead(404).end()
        data = injectConfig(await readFile(join(dist, 'index.html'), 'utf8'), base)
        res.setHeader('Cache-Control', 'no-store')
      }
      res.writeHead(200, { 'Content-Type': type }).end(req.method === 'HEAD' ? undefined : data)
    })().catch(() => { if (!res.headersSent) json(res, 500, { error: 'Internal error' }); else res.end() })
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const db = await openDb()
    const server = createApp(db, { basePath: process.env.BASE_PATH, password: process.env.ADMIN_PASSWORD ?? '', production: process.env.NODE_ENV === 'production', publicOrigin: process.env.PUBLIC_ORIGIN })
    server.listen(3000, '0.0.0.0', () => console.log('Listening on port 3000'))
    for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => server.close(() => { void db.end().then(() => process.exit(0)) }))
  } catch (error) { console.error('Startup failed: check database and runtime configuration', error instanceof Error ? error.message : ''); process.exit(1) }
}
