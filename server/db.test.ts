import { test } from 'node:test'
import assert from 'node:assert/strict'
import { insertRound, openDb } from './db.ts'

const VALID = {
  sessionId: 'abc-123',
  levelId: 'ch1-4',
  levelIndex: 3,
  cleared: true,
  clearMs: 2100,
  quitMs: null,
  advancedAfterClear: true,
  resetCount: 1,
  undoCount: 2,
  firstMoveMs: 500,
  maxGapMs: 1300,
  actions: [{ kind: 'move', direction: 'up', t: 500 }],
}

test('유효한 라운드는 챕터/라운드를 levelId에서 뽑아 저장한다', () => {
  const db = openDb(':memory:')
  insertRound(db, VALID)

  const row = db.prepare('SELECT * FROM rounds').get() as Record<string, unknown>
  assert.equal(row.chapter, 'ch1')
  assert.equal(row.round, 4)
  assert.equal(row.cleared, 1)
  assert.equal(row.quit_ms, null)
  assert.equal(row.max_gap_ms, 1300)
  assert.deepEqual(JSON.parse(row.actions as string), VALID.actions)
})

test('잘못된 본문은 거부한다', () => {
  const db = openDb(':memory:')
  const bad: Record<string, unknown>[] = [
    { ...VALID, levelId: 'nope' }, // 챕터 형식 아님
    { ...VALID, sessionId: '' },
    { ...VALID, cleared: 'yes' }, // 불리언 아님
    { ...VALID, resetCount: -1 },
    { ...VALID, actions: [{ kind: 'fly', direction: null, t: 0 }] },
    { ...VALID, actions: 'nope' },
  ]
  for (const body of bad) assert.throws(() => insertRound(db, body))
  assert.equal((db.prepare('SELECT count(*) AS n FROM rounds').get() as { n: number }).n, 0)
})
