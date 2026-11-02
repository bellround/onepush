import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { IncomingMessage } from 'node:http'
import type { Pool } from 'pg'
import { credentials, createPlayerLimiter, enterPlayer, getPlayer, hashPassword, newSession, playerCookie, revokeSession, saveProgress, verifyPassword } from './player.ts'
import { openDb } from './db.ts'
import { sourceCatalog } from './catalog.ts'
import { createApp } from './index.ts'
import { glob } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

test('salted async password hashing, bounded credentials and rate limit', async () => {
  const a = await hashPassword('password')
  assert.notEqual(a, await hashPassword('password'))
  assert.equal(await verifyPassword('password', a), true)
  assert.equal(await verifyPassword('wrong', a), false)
  for (const value of [null, {}, { username: 'a b', password: 'x' }, { username: 'x', password: '' }, { username: 'x', password: 'x'.repeat(129) }]) assert.throws(() => credentials(value))
  assert.deepEqual(credentials({ username: '학생_1', password: 'x' }), { username: '학생_1', password: 'x' })
  let now = 0
  const limiter = createPlayerLimiter(() => now)
  for (let i = 0; i < 10; i++) { assert.equal(limiter.acquire('ip'), true); limiter.release() }
  assert.equal(limiter.acquire('ip'), false)
  now = 60_000
  assert.equal(limiter.acquire('ip'), true)
  assert.match(playerCookie('token', '/school', true), /Path=\/school; HttpOnly; SameSite=Strict; Max-Age=2592000; Secure/)
  assert.match(playerCookie('', '', false, true), /Max-Age=0/)
})

test('canonical catalog has unique ordered stage IDs', async () => {
  const ids = await sourceCatalog()
  const root = fileURLToPath(new URL('../src/levels', import.meta.url))
  const paths: string[] = []
  for await (const path of glob('chapter/ch*/*.ts', { cwd: root })) paths.push(path)
  const expected: string[] = []
  for (const path of paths.sort()) {
    const { default: level } = await import(pathToFileURL(resolve(root, path)).href)
    expected.push(level.id)
  }
  assert.ok(ids.length > 0)
  assert.deepEqual(ids, expected)
  assert.equal(new Set(ids).size, ids.length)
})

test('HTTP player auth, origin, locked stages and telemetry identity', async () => {
  const player = { id: '1', username: 'real-player', progress: 0 }
  let failing = false
  let inserted: unknown[] = []
  let writes = 0
  const db = { query: async (sql: string, args: unknown[]) => {
    if (failing) throw new Error('secret')
    if (sql.includes('JOIN player_sessions')) return { rows: [player] }
    if (sql.startsWith('UPDATE players')) {
      writes++
      const index = args[1] as number
      if (index > player.progress) return { rows: [] }
      player.progress = Math.max(player.progress, index + 1)
      return { rows: [player] }
    }
    if (sql.startsWith('INSERT INTO rounds')) { inserted = args; writes++ }
    return { rows: [] }
  } } as unknown as Pool
  const server = createApp(db, { password: 'admin', basePath: '/school', publicOrigin: 'https://school.test', levelIds: ['ch1-1', 'ch1-2', 'ch1-3'] })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const root = `http://127.0.0.1:${(server.address() as { port: number }).port}/school/api`
  const headers = { origin: 'https://school.test', cookie: `ion_player=${'a'.repeat(64)}` }
  const post = (path: string, body: unknown, h = headers) => fetch(root + path, { method: 'POST', headers: h, body: JSON.stringify(body) })
  try {
    assert.equal((await fetch(root + '/account')).status, 401)
    assert.equal((await post('/rounds', {}, { ...headers, cookie: '' })).status, 401)
    assert.equal((await post('/account/progress', {}, { ...headers, origin: 'https://evil.test' })).status, 403)
    for (const path of ['/account/progress', '/rounds']) {
      assert.equal((await post(path, { levelId: 'ch1-1' })).status, 400)
      assert.equal((await post(path, { levelId: 'ch1-1', expectedUsername: 'previous-player' })).status, 409)
    }
    assert.equal(writes, 0)
    const expectedUsername = 'real-player'
    assert.equal((await post('/account/progress', { levelId: 'unknown', expectedUsername })).status, 400)
    assert.equal((await post('/account/progress', { levelId: 'ch1-3', expectedUsername })).status, 409)
    assert.deepEqual(await (await post('/account/progress', { levelId: 'ch1-1', username: 'spoof', expectedUsername })).json(), { username: 'real-player', progress: 1 })
    assert.deepEqual(await (await post('/account/progress', { levelId: 'ch1-1', expectedUsername })).json(), { username: 'real-player', progress: 1 })
    assert.equal((await post('/rounds', { username: 'spoof', expectedUsername, sessionId: 'x', levelId: 'ch1-1', levelIndex: 0, cleared: true, advancedAfterClear: false, resetCount: 0, undoCount: 0, actions: [] })).status, 204)
    assert.equal(inserted.at(-1), 'real-player')
    assert.equal((await fetch(root + '/admin/rounds', { headers })).status, 401)
    failing = true
    assert.equal((await fetch(root + '/account', { headers })).status, 503)
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})

test('PostgreSQL registration races, password protection, progress isolation and session expiry/revocation', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const db = await openDb(process.env.TEST_DATABASE_URL)
  const username = `test_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`
  const other = username + '_2'
  try {
    const [a, b] = await Promise.all([enterPlayer(db, username, 'one'), enterPlayer(db, username, 'two')])
    assert.equal(Number(!!a) + Number(!!b), 1)
    const player = (a ?? b)!
    assert.equal(await enterPlayer(db, username, 'wrong'), null)
    const isolated = (await enterPlayer(db, other, 'password'))!
    assert.equal(await saveProgress(db, player, 2), null)
    await Promise.all([saveProgress(db, player, 0), saveProgress(db, player, 0)])
    assert.equal((await saveProgress(db, player, 1))!.progress, 2)
    assert.equal((await saveProgress(db, player, 0))!.progress, 2)
    assert.equal((await enterPlayer(db, other, 'password'))!.progress, 0)
    const token = await newSession(db, player)
    const req = { headers: { cookie: `ion_player=${token}` } } as IncomingMessage
    assert.equal((await getPlayer(db, req))!.username, username)
    await revokeSession(db, req)
    assert.equal(await getPlayer(db, req), null)
    const expired = await newSession(db, isolated)
    await db.query('UPDATE player_sessions SET expires_at = now() WHERE player_id = $1', [isolated.id])
    assert.equal(await getPlayer(db, { headers: { cookie: `ion_player=${expired}` } } as IncomingMessage), null)
  } finally { await db.query('DELETE FROM players WHERE username IN ($1, $2)', [username, other]); await db.end() }
})
