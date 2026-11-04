import assert from 'node:assert/strict'
import { test } from 'node:test'
import { interpolatePositions, MOVE_MS } from './boardAnimation.ts'

const start = [{ id: 'a', row: 1, col: 1 }, { id: 'b', row: 1, col: 2 }]
const end = start.map((p) => ({ ...p, row: p.row + 1 }))

test('movement lasts 120ms and preserves CSS ease at intermediate frames', () => {
  assert.equal(MOVE_MS, 120)
  assert.deepEqual(interpolatePositions(start, end, 0), start)
  const halfway = interpolatePositions(start, end, 60)
  assert.ok(Math.abs(halfway[0].row - 1.802403) < 0.00001)
  for (let elapsed = 0; elapsed <= 120; elapsed += 10) {
    const [a, b] = interpolatePositions(start, end, elapsed)
    assert.equal(a.row, b.row)
    assert.equal(b.col - a.col, 1)
  }
  assert.deepEqual(interpolatePositions(start, end, 120), end)
  assert.deepEqual(interpolatePositions(start, end, 1000), end)
})

test('rapid movement, undo, and reset start from the displayed intermediate position', () => {
  const displayed = interpolatePositions(start, end, 35)
  for (const target of [start, end.map((p) => ({ ...p, col: p.col + 1 }))]) {
    assert.deepEqual(interpolatePositions(displayed, target, 0), displayed)
    assert.deepEqual(interpolatePositions(displayed, target, 120), target)
  }
})

test('identity rather than array order matches atoms, and new/removed atoms are safe', () => {
  assert.deepEqual(interpolatePositions(start, [...end].reverse(), 0), [...start].reverse())
  const added = { id: 'c', row: 3, col: 3 }
  assert.deepEqual(interpolatePositions(start, [added], 60), [added])
  assert.deepEqual(interpolatePositions(start, [], 60), [])
})

test('unchanged coordinates (including bond-order-only changes) do not drift', () => {
  assert.deepEqual(interpolatePositions(start, start, 60), start)
})
