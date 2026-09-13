/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { finishRound, recordAction, recordClear, startRound } from './telemetry.ts'

test('클리어한 라운드 — 첫 수 시각, 최대 간격, 횟수 집계', () => {
  const run = startRound('ch1-4', 3, 1000)
  recordAction(run, 'move', 'up', null, 1500) // 첫 수: 500ms
  recordAction(run, 'move', 'left', null, 1700) // 간격 200ms
  recordAction(run, 'undo', null, null, 1800)
  recordAction(run, 'reset', null, null, 1900)
  recordAction(run, 'move', 'right', null, 3000) // 간격 1300ms ← 최대
  recordClear(run, 3100)

  const record = finishRound(run, true, 4000)

  assert.equal(record.cleared, true)
  assert.equal(record.clearMs, 2100)
  assert.equal(record.quitMs, null)
  assert.equal(record.advancedAfterClear, true)
  assert.equal(record.firstMoveMs, 500)
  assert.equal(record.maxGapMs, 1300)
  assert.equal(record.resetCount, 1)
  assert.equal(record.undoCount, 1)
  assert.equal(record.actions.length, 5)
})

test('클리어 판정이 여러 번 들어와도 첫 시각만 남는다', () => {
  const run = startRound('ch1-1', 0, 0)
  recordClear(run, 500)
  recordClear(run, 900)
  assert.equal(run.clearMs, 500)
})

test('포기한 라운드 — 종료 시점이 기록되고 클리어 시간은 null', () => {
  const run = startRound('ch2-3', 7, 0)
  const record = finishRound(run, false, 2500)

  assert.equal(record.cleared, false)
  assert.equal(record.clearMs, null)
  assert.equal(record.quitMs, 2500)
  assert.equal(record.firstMoveMs, null)
  assert.equal(record.maxGapMs, null) // 수가 1개 이하면 간격 없음
})
