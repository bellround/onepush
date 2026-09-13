import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { insertRound, openDb } from './db.ts'

const PORT = Number(process.env.PORT ?? 3000)
const DIST = resolve(import.meta.dirname, '../dist')
const MAX_BODY = 2_000_000

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const db = openDb()

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new Error('body too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

// dist 안의 파일만 내보낸다. 없는 경로는 index.html (SPA 라우팅).
async function serveStatic(url: string, res: ServerResponse): Promise<void> {
  const path = decodeURIComponent(url.split('?')[0])
  const file = resolve(DIST, '.' + path)
  const target = file.startsWith(DIST + sep) ? file : join(DIST, 'index.html')
  try {
    const data = await readFile(target)
    res.writeHead(200, { 'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream' }).end(data)
  } catch {
    res.writeHead(200, { 'Content-Type': TYPES['.html'] }).end(await readFile(join(DIST, 'index.html')))
  }
}

createServer((req, res) => {
  void (async () => {
    if (req.method === 'POST' && req.url === '/api/rounds') {
      try {
        insertRound(db, JSON.parse(await readBody(req)))
        res.writeHead(204).end()
      } catch (err) {
        console.warn('rounds 저장 실패:', err instanceof Error ? err.message : err)
        res.writeHead(400).end()
      }
      return
    }
    if (req.method !== 'GET') {
      res.writeHead(405).end()
      return
    }
    await serveStatic(req.url ?? '/', res)
  })().catch(() => res.writeHead(500).end())
}).listen(PORT, () => console.log(`http://localhost:${PORT}`))
