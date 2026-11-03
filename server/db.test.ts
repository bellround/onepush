import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportDb, listRounds, openDb, pagination, roundValues, roundIdentity, saveRound, insertRound, ROUND_COLUMNS } from './db.ts'

export const VALID = {
  sessionId: 'abc-123', levelId: 'ch1-4', levelIndex: 3, cleared: true,
  clearMs: 2100, quitMs: null, advancedAfterClear: true, resetCount: 1,
  undoCount: 2, firstMoveMs: 500, maxGapMs: 1300,
  actions: [{ kind: 'move', direction: 'up', t: 500, board: [[{ ion: 'Na', charge: 1 }]], extra: { preserved: true } }],
}

test('round identity validates explicit owners and paired version fields without changing legacy values', () => {
  const roundId = crypto.randomUUID()
  assert.deepEqual(roundIdentity(VALID), { owner: undefined, roundId: null, revision: null })
  for (const owner of [{ kind: 'guest' }, { kind: 'member', expectedUsername: 'Kim' }]) {
    const body = { ...VALID, owner, roundId, revision: 1 }
    assert.deepEqual(roundIdentity(body), { owner, roundId, revision: 1 })
    assert.deepEqual(roundValues(body), roundValues(VALID))
  }
  for (const change of [{ roundId: 'invalid' }, { revision: 0 }, { revision: -1 }, { revision: 1.5 }, { revision: '1' }, { revision: 1e12 + 1 }, { revision: undefined }, { roundId: undefined }, { owner: null }, { owner: [] }, { owner: { kind: 'unknown' } }, { owner: { kind: 'member' }, expectedUsername: 'Kim' }]) {
    assert.throws(() => roundIdentity({ owner: { kind: 'guest' }, roundId, revision: 1, ...change }))
  }
})

test('PostgreSQL higher revisions win atomically within guest/member ownership scopes', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const db = await openDb(process.env.TEST_DATABASE_URL)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query('CREATE TEMP TABLE rounds (LIKE public.rounds INCLUDING ALL) ON COMMIT DROP')
    const roundId = crypto.randomUUID()
    const save = (revision: number, username: string | null = null, sessionId = 'guest-a', quitMs = revision * 100) => {
      const body = { ...VALID, sessionId, roundId, revision, quitMs, cleared: revision >= 2 }
      return saveRound(client, roundValues(body), roundIdentity(body), username)
    }
    await save(1)
    const original = (await client.query('SELECT id, created_at FROM rounds')).rows[0]
    await save(3)
    await save(3, null, 'guest-a', 999)
    await save(1)
    const row = (await client.query('SELECT * FROM rounds')).rows[0]
    assert.equal(row.revision, '3')
    assert.equal(row.quit_ms, 300)
    assert.equal(row.cleared, true)
    assert.equal(row.id, original.id)
    assert.deepEqual(row.created_at, original.created_at)
    await save(1, null, 'guest-b')
    await save(1, 'Alice')
    await save(2, 'Alice', 'new-session')
    await save(1, 'Bob')
    const rows = (await client.query('SELECT username, session_id, revision FROM rounds ORDER BY username NULLS FIRST, session_id')).rows
    assert.deepEqual(rows, [
      { username: null, session_id: 'guest-a', revision: '3' },
      { username: null, session_id: 'guest-b', revision: '1' },
      { username: 'Alice', session_id: 'new-session', revision: '2' },
      { username: 'Bob', session_id: 'guest-a', revision: '1' },
    ])
    await insertRound(client, VALID)
    await insertRound(client, VALID)
    assert.equal((await client.query('SELECT count(*) FROM rounds WHERE round_id IS NULL AND revision IS NULL')).rows[0].count, '2')
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await db.end()
  }
})

test('actual PostgreSQL export includes complete tables, exact IDs and microsecond timestamps', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const db = await openDb(process.env.TEST_DATABASE_URL)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query('CREATE TEMP TABLE rounds (LIKE public.rounds INCLUDING DEFAULTS) ON COMMIT DROP')
    await client.query('CREATE TEMP TABLE round_imports (LIKE public.round_imports) ON COMMIT DROP')
    const empty = await exportDb(client)
    assert.deepEqual(empty.rounds, [])
    assert.deepEqual(empty.round_imports, [])
    const values = roundValues(VALID)
    await client.query(`INSERT INTO rounds (id, created_at, ${ROUND_COLUMNS}) SELECT 9007199254740992::bigint + fixture_id, '2026-01-02 03:04:05.123456+00'::timestamptz, ${values.map((_, i) => `$${i + 1}`).join(', ')} FROM generate_series(1, 105) AS fixture_id`, values)
    await client.query("INSERT INTO round_imports SELECT 'fixture', id::text, 'hash', id FROM rounds")
    const data = await exportDb(client)
    const expectedRounds = await client.query('SELECT *, id::text, created_at::text FROM rounds ORDER BY id::bigint')
    const expectedImports = await client.query('SELECT *, round_id::text FROM round_imports ORDER BY source, source_id')
    assert.equal(data.formatVersion, 1)
    assert.equal(new Date(data.exportedAt).toISOString(), data.exportedAt)
    assert.equal(data.rounds.length, 105)
    assert.equal(data.round_imports.length, 105)
    assert.deepEqual(data.rounds, expectedRounds.rows)
    assert.deepEqual(data.round_imports, expectedImports.rows)
    assert.equal(data.rounds[0].id, '9007199254740993')
    assert.match(data.rounds[0].created_at, /\.123456/)
    assert.deepEqual(data.rounds[0].actions, VALID.actions)
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await db.end()
  }
})

test('validation preserves every round and action field', () => {
  assert.deepEqual(roundValues(VALID), ['abc-123', 'ch1', 4, 'ch1-4', 3, true, 2100, null, true, 1, 2, 500, 1300, JSON.stringify(VALID.actions)])
  for (const change of [{ levelId: 'nope' }, { sessionId: '' }, { cleared: 'yes' }, { resetCount: -1 }, { actions: [{ kind: 'fly', direction: null, t: 0 }] }, { actions: 'nope' }]) {
    assert.throws(() => roundValues({ ...VALID, ...change }))
  }
})

test('pagination validates exact bigint cursors and bounded limits', () => {
  assert.deepEqual(pagination(new URLSearchParams()), { limit: 50, beforeId: null })
  assert.equal(pagination(new URLSearchParams('beforeId=9007199254740993')).beforeId, '9007199254740993')
  for (const query of ['limit=0', 'limit=101', 'limit=1.5', 'beforeId=-1', 'beforeId=9223372036854775808', 'beforeId=1e3']) assert.throws(() => pagination(new URLSearchParams(query)))
})

test('actual PostgreSQL schema, all fields and cursor', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const db = await openDb(process.env.TEST_DATABASE_URL)
  const sessionId = `test-${crypto.randomUUID()}`
  try {
    await insertRound(db, { ...VALID, sessionId })
    await insertRound(db, { ...VALID, sessionId })
    const page = await listRounds(db, { limit: 1, beforeId: null })
    assert.equal(page.hasMore, true)
    const row = page.rows[0]
    assert.equal(typeof row.id, 'string')
    assert.deepEqual(Object.keys(row).sort(), ['id', 'session_id', 'chapter', 'round', 'level_id', 'level_index', 'cleared', 'clear_ms', 'quit_ms', 'advanced_after_clear', 'reset_count', 'undo_count', 'first_move_ms', 'max_gap_ms', 'actions', 'created_at', 'username'].sort())
    assert.deepEqual(row.actions, VALID.actions)
    assert.equal(row.cleared, true)
    assert.equal(row.round, 4)
    assert.equal(row.quit_ms, null)
    assert.equal(row.max_gap_ms, 1300)
    const next = await listRounds(db, { limit: 1, beforeId: page.nextBeforeId })
    assert.ok(BigInt(next.rows[0].id) < BigInt(row.id))
  } finally { await db.query('DELETE FROM rounds WHERE session_id=$1', [sessionId]); await db.end() }
})

test('actual PostgreSQL pagination reaches all 105 IDs in numeric order across digit boundaries', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const db = await openDb(process.env.TEST_DATABASE_URL)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    // A connection-local table isolates explicit fixture IDs from other tests and records.
    await client.query('CREATE TEMP TABLE rounds (LIKE public.rounds INCLUDING DEFAULTS) ON COMMIT DROP')
    const values = roundValues(VALID)
    await client.query(`INSERT INTO rounds (id, ${ROUND_COLUMNS}) SELECT fixture_id, ${values.map((_, i) => `$${i + 1}`).join(', ')} FROM generate_series(1, 105) AS fixture_id`, values)
    const expected = Array.from({ length: 105 }, (_, i) => String(105 - i))
    const actual: string[] = []
    const cursors: (string | null)[] = [null]
    const sizes: number[] = []
    for (let index = 0; index < 3; index++) {
      const page = await listRounds(client, { limit: 50, beforeId: cursors[index] })
      const ids = page.rows.map(row => row.id as string)
      assert.deepEqual(ids, expected.slice(index * 50, (index + 1) * 50))
      assert.equal(page.hasMore, index < 2)
      assert.equal(page.nextBeforeId, index < 2 ? ids.at(-1) : null)
      actual.push(...ids)
      sizes.push(ids.length)
      cursors.push(page.nextBeforeId)
    }
    assert.deepEqual(sizes, [50, 50, 5])
    assert.deepEqual(actual, expected)
    assert.equal(new Set(actual).size, 105)
    const previous = await listRounds(client, { limit: 50, beforeId: cursors[1] })
    assert.deepEqual(previous.rows.map(row => row.id), expected.slice(50, 100))
    const exhausted = await listRounds(client, { limit: 50, beforeId: '1' })
    assert.deepEqual(exhausted, { rows: [], hasMore: false, nextBeforeId: null })
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await db.end()
  }
})
