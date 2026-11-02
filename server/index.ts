import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Pool } from 'pg'
import { INSERT_ROUND, listRounds, openDb, pagination, roundValues } from './db.ts'
import { createAuth, sameOrigin } from './auth.ts'
import { injectConfig, normalizeBase } from './platform.ts'

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

export function createApp(db: Pick<Pool, 'query'>, options: { basePath?: string; password: string; production?: boolean; publicOrigin?: string; dist?: string }) {
  const base = normalizeBase(options.basePath)
  const auth = createAuth(options.password)
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
          if (path === '/api/admin/rounds' && req.method === 'GET') {
            if (!auth.allowed(req)) return json(res, 401, { error: 'Unauthorized' })
            let page
            try { page = pagination(url.searchParams) } catch { return json(res, 400, { error: 'Invalid pagination' }) }
            try { return json(res, 200, await listRounds(db, page)) } catch { return json(res, 503, { error: 'Database unavailable' }) }
          }
        }
        if (path === '/api/rounds' && req.method === 'POST') {
          let values
          try { values = roundValues(await readBody(req)) } catch (error) { return json(res, error instanceof RangeError ? 413 : 400, { error: 'Invalid round' }) }
          try { await db.query(INSERT_ROUND, values) } catch { return json(res, 503, { error: 'Database unavailable' }) }
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
  } catch { console.error('Startup failed: check database and runtime configuration'); process.exit(1) }
}
