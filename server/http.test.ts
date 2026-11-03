import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Pool } from 'pg'
import { createApp } from './index.ts'
import { normalizeBase, injectConfig } from './platform.ts'
import { createAuth } from './auth.ts'
import type { IncomingMessage } from 'node:http'

test('explicit guest telemetry ignores sessions; member ownership and legacy authentication remain required', async () => {
  const writes: unknown[][] = []
  let lookups = 0
  let expired = false
  let failing = false
  const db = { query: async (sql: string, args: unknown[]) => {
    if (sql.includes('JOIN player_sessions')) { lookups++; return { rows: expired ? [] : [{ id: '1', username: 'Kim', progress: 0 }] } }
    if (failing) throw new Error('private database error')
    writes.push(args)
    return { rows: [] }
  } } as unknown as Pool
  const server = createApp(db, { password: 'test-only', basePath: '/school', levelIds: ['ch1-1'] })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const root = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const headers = { origin: root, cookie: `ion_player=${'a'.repeat(64)}` }
  const body = { sessionId: 'guest-session', levelId: 'ch1-1', levelIndex: 0, cleared: true, clearMs: 100, advancedAfterClear: false, resetCount: 0, undoCount: 0, actions: [], roundId: crypto.randomUUID(), revision: 1, owner: { kind: 'guest' } }
  const post = (payload: unknown, h = headers, path = '/rounds') => fetch(`${root}/school/api${path}`, { method: 'POST', headers: h, body: JSON.stringify(payload) })
  try {
    assert.equal((await post(body, { ...headers, cookie: '' })).status, 204)
    assert.equal((await post({ ...body, username: 'spoof', expectedUsername: 'Kim' })).status, 204)
    assert.equal(lookups, 0)
    assert.equal(writes[0][14], null)
    assert.equal(writes[1][14], null)
    assert.equal((await post(body, { ...headers, origin: 'https://evil.test' })).status, 403)
    assert.equal((await post({ ...body, revision: 0 })).status, 400)
    assert.equal((await post({ ...body, owner: { kind: 'member' }, expectedUsername: 'Kim' })).status, 400)
    assert.equal((await post({ ...body, owner: { kind: 'member', expectedUsername: 'Old' }, expectedUsername: 'Kim' })).status, 409)
    const member = { ...body, owner: { kind: 'member', expectedUsername: 'Kim' }, expectedUsername: 'ignored' }
    assert.equal((await post(member)).status, 204)
    assert.equal(writes.at(-1)![14], 'Kim')
    expired = true
    assert.equal((await post(member)).status, 401)
    assert.equal((await post({ ...body, owner: undefined, expectedUsername: 'Kim' })).status, 401)
    assert.equal((await post(body)).status, 204)
    assert.equal((await post(body, { ...headers, cookie: '' }, '/account/progress')).status, 401)
    failing = true
    const response = await post(body)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'Database unavailable' })
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})

test('admin JSON export requires auth and origin, supports prefix, and hides database failures', async () => {
  let failing = false
  let calls = 0
  const tables = {
    rounds: Array.from({ length: 105 }, (_, i) => ({ id: String(9007199254740993n + BigInt(i)), actions: [{ extra: { preserved: true } }], created_at: '2026-01-02 03:04:05.123456+00' })),
    round_imports: [{ source: 'fixture', source_id: '1', content_hash: 'hash', round_id: '9007199254740993' }],
  }
  const db = { query: async () => { calls++; if (failing) throw new Error('private credentials'); return { rows: [tables] } } } as unknown as Pool
  const server = createApp(db, { basePath: '/students/1116', password: 'test-only', publicOrigin: 'https://example.test' })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const root = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    for (const authorization of ['', 'Bearer invalid']) {
      const denied = await fetch(`${root}/api/admin/export`, { headers: { authorization } })
      assert.equal(denied.status, 401)
      assert.equal(denied.headers.get('cache-control'), 'no-store')
      assert.equal(denied.headers.get('content-disposition'), null)
    }
    const login = await fetch(`${root}/api/admin/login`, { method: 'POST', headers: { origin: 'https://example.test' }, body: JSON.stringify({ password: 'test-only' }) })
    assert.equal(login.status, 200)
    const { token } = await login.json() as { token: string }
    const authorization = `Bearer ${token}`
    assert.equal((await fetch(`${root}/api/admin/export`, { headers: { authorization, origin: 'https://evil.test' } })).status, 403)
    assert.equal(calls, 0)
    for (const prefix of ['', '/students/1116']) {
      const response = await fetch(`${root}${prefix}/api/admin/export?limit=1&beforeId=1`, { headers: { authorization } })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), 'application/json')
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('content-security-policy'), "frame-ancestors 'none'")
      assert.equal(response.headers.get('x-frame-options'), 'DENY')
      const body = await response.json() as { exportedAt: string }
      assert.equal(new Date(body.exportedAt).toISOString(), body.exportedAt)
      assert.equal(response.headers.get('content-disposition'), `attachment; filename="ion-puzzle-db-${body.exportedAt.slice(0, 10)}.json"`)
      assert.deepEqual(body, { formatVersion: 1, exportedAt: body.exportedAt, ...tables })
    }
    assert.equal(calls, 2)
    failing = true
    const response = await fetch(`${root}/api/admin/export`, { headers: { authorization } })
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('content-disposition'), null)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { error: 'Database unavailable' })
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})

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
  const db = { query: async () => { if (failing) throw new Error('private database error'); return { rows: [{ id: '1', username: 'player', progress: 0 }] } } } as unknown as Pool
  const server = createApp(db, { password: 'test-only' })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const root = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const body = JSON.stringify({ expectedUsername: 'player', sessionId: 'test', levelId: 'ch1-1', levelIndex: 0, cleared: false, advancedAfterClear: false, resetCount: 0, undoCount: 0, actions: [] })
  const headers = { origin: root, cookie: `ion_player=${'a'.repeat(64)}` }
  try {
    assert.equal((await fetch(`${root}/api/rounds`, { method: 'POST', body, headers })).status, 204)
    failing = true
    const response = await fetch(`${root}/api/rounds`, { method: 'POST', body, headers })
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
    assert.equal((await fetch(`${root}/api/rounds`, { method: 'POST', headers: { origin, cookie: `ion_player=${'a'.repeat(64)}` }, body: '{}' })).status, 400)
    assert.equal((await fetch(`${root}/api/rounds`, { method: 'POST', headers: { origin, cookie: `ion_player=${'a'.repeat(64)}` }, body: 'x'.repeat(2_000_001) })).status, 413)
    for (let i = 0; i < 12; i++) assert.equal((await fetch(`${root}/api/admin/login`, { method: 'POST', headers: { origin }, body: '{"password":"wrong"}' })).status, 401)
    assert.equal((await fetch(`${root}/api/admin/login`, { method: 'POST', headers: { origin }, body: '{"password":"test-only"}' })).status, 200)
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
