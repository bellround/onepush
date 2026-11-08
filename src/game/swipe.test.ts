import assert from 'node:assert/strict'
import { test } from 'node:test'
import { swipeDirection, SWIPE_MIN } from './swipe.ts'

test('swipe picks one direction from the dominant axis', () => {
  assert.equal(swipeDirection(SWIPE_MIN, 0), 'right')
  assert.equal(swipeDirection(-SWIPE_MIN, 0), 'left')
  assert.equal(swipeDirection(0, SWIPE_MIN), 'down')
  assert.equal(swipeDirection(0, -SWIPE_MIN), 'up')
  // 대각선 — 더 많이 움직인 축만 남는다.
  assert.equal(swipeDirection(60, -40), 'right')
  assert.equal(swipeDirection(-40, 60), 'down')
})

test('swipe ignores gestures shorter than the threshold', () => {
  assert.equal(swipeDirection(0, 0), null)
  assert.equal(swipeDirection(SWIPE_MIN - 1, 0), null)
  assert.equal(swipeDirection(0, SWIPE_MIN - 1), null)
  // 우세 축이 임계값 미만이면 다른 축이 넘더라도 null이 아니라 그 축을 쓴다.
  assert.equal(swipeDirection(5, SWIPE_MIN), 'down')
})
