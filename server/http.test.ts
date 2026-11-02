import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Pool } from 'pg'
import { createApp } from './index.ts'
import { normalizeBase, injectConfig } from './platform.ts'
import { createAuth } from './auth.ts'
import type { IncomingMessage } from 'node:http'

test('base config is safe and stable on nested routes', () => {
  assert.equal(normalizeBase('/students/1116/'), '/students/1116')
  assert.throws(() => normalizeBase('/bad"<script>'))
  assert.match(injectConfig('<!-- runtime-config -->', '/students/1116'), /<base href="\/students\/1116\/">/)
  let now = 0
  const auth = createAuth('test-only', () => now)
  const req = { headers: {}, socket: { remoteAddress: 'test' } } as IncomingMessage
  const token = auth.login(req, 'test-only').token!
  assert.match(token, /^[a-f0-9]{64}$/)
  req.headers.authorization = `Bearer ${token}`
  assert.equal(auth.allowed(req), true)
  now = 8 * 60 * 60 * 1000
  assert.equal(auth.allowed(req), false)
  assert.throws(() => createAuth(''))
  assert.throws(() => createApp({} as Pool, { password: '' }))
})

test('valid telemetry is asynchronous and database failures return 503', async () => {
  let failing = false
  const db = { query: async () => { if (failing) throw new Error('private database error'); return { rows: [] } } } as unknown as Pool
  const server = createApp(db, { password: 'test-only' })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const root = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const body = JSON.stringify({ sessionId: 'test', levelId: 'ch1-1', levelIndex: 0, cleared: false, advancedAfterClear: false, resetCount: 0, undoCount: 0, actions: [] })
  try {
    assert.equal((await fetch(`${root}/api/rounds`, { method: 'POST', body })).status, 204)
    failing = true
    const response = await fetch(`${root}/api/rounds`, { method: 'POST', body })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'Database unavailable' })
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})

test('admin auth, origin, logout, cursor, errors and stripped routes', async () => {
  const calls: unknown[][] = []
  const db = { query: async (...args: unknown[]) => { calls.push(args); return { rows: [{ id: '9007199254740994', actions: [{ board: [[1]], kind: 'move', direction: 'up', t: 0 }], created_at: new Date(0) }, { id: '9007199254740993', created_at: new Date(0) }] } } } as unknown as Pool
  const server = createApp(db, { basePath: '/students/1116', password: 'test-only', publicOrigin: 'https://example.test' })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const root = `http://127.0.0.1:${address.port}`
  const origin = 'https://example.test'
  try {
    assert.equal((await fetch(`${root}/api/admin/rounds`)).status, 401)
    assert.equal((await fetch(`${root}/api/admin/login`, { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' })).status, 403)
    const login = await fetch(`${root}/students/1116/api/admin/login`, { method: 'POST', headers: { origin }, body: JSON.stringify({ password: 'test-only' }) })
    assert.equal(login.status, 200)
    assert.equal(login.headers.get('cache-control'), 'no-store')
    assert.equal(login.headers.get('set-cookie'), null)
    assert.equal(login.headers.get('content-security-policy'), "frame-ancestors 'none'")
    const { token } = await login.json() as { token: string }
    const authorization = `Bearer ${token}`
    assert.equal((await fetch(`${root}/api/admin/rounds`, { headers: { cookie: `ion_admin_legacy=${token}` } })).status, 401)
    const response = await fetch(`${root}/api/admin/rounds?limit=1&beforeId=9007199254740995`, { headers: { authorization } })
    const page = await response.json() as { nextBeforeId: string; hasMore: boolean; rows: { actions: { board: number[][] }[]; created_at: string }[] }
    assert.equal(page.nextBeforeId, '9007199254740994')
    assert.equal(page.hasMore, true)
    assert.deepEqual(page.rows[0].actions[0].board, [[1]])
    assert.equal(page.rows[0].created_at, '1970-01-01T00:00:00.000Z')
    assert.deepEqual(calls[0][1], ['9007199254740995', 2])
    assert.equal((await fetch(`${root}/api/admin/rounds?limit=101`, { headers: { authorization } })).status, 400)
    assert.equal((await fetch(`${root}/api/admin/logout`, { method: 'POST', headers: { origin } })).status, 401)
    assert.equal((await fetch(`${root}/api/admin/logout`, { method: 'POST', headers: { origin, authorization } })).status, 204)
    assert.equal((await fetch(`${root}/api/admin/rounds`, { headers: { authorization } })).status, 401)
    assert.equal((await fetch(`${root}/api/missing`)).status, 404)
    assert.equal((await fetch(`${root}/api/rounds`, { method: 'POST', body: '{}' })).status, 400)
    assert.equal((await fetch(`${root}/api/rounds`, { method: 'POST', body: 'x'.repeat(2_000_001) })).status, 413)
    for (let i = 0; i < 12; i++) assert.equal((await fetch(`${root}/api/admin/login`, { method: 'POST', headers: { origin }, body: '{"password":"wrong"}' })).status, 401)
    assert.equal((await fetch(`${root}/api/admin/login`, { method: 'POST', headers: { origin }, body: '{"password":"test-only"}' })).status, 200)
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
