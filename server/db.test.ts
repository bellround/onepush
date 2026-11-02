import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listRounds, openDb, pagination, roundValues, insertRound, ROUND_COLUMNS } from './db.ts'

export const VALID = {
  sessionId: 'abc-123', levelId: 'ch1-4', levelIndex: 3, cleared: true,
  clearMs: 2100, quitMs: null, advancedAfterClear: true, resetCount: 1,
  undoCount: 2, firstMoveMs: 500, maxGapMs: 1300,
  actions: [{ kind: 'move', direction: 'up', t: 500, board: [[{ ion: 'Na', charge: 1 }]], extra: { preserved: true } }],
}

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
    assert.deepEqual(Object.keys(row).sort(), ['id', 'session_id', 'chapter', 'round', 'level_id', 'level_index', 'cleared', 'clear_ms', 'quit_ms', 'advanced_after_clear', 'reset_count', 'undo_count', 'first_move_ms', 'max_gap_ms', 'actions', 'created_at'].sort())
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
