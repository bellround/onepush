/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SOUNDS, allowPlay, moveSound } from './sfx.ts'
import type { Board, Bond } from './types.ts'
import type { SfxName } from './sfx.ts'

function board(bonds: Bond[]): Board {
  return { rows: 3, cols: 3, tiles: [], bonds, walls: [], bonders: [], controlledId: 'a' }
}

test('아무것도 못 움직였으면 막힘 소리', () => {
  const before = board([])

  assert.equal(moveSound(before, before), 'blocked')
})

test('결합선이 새로 생기면 결합 소리', () => {
  assert.equal(moveSound(board([]), board([{ a: 'a', b: 'b', order: 1 }])), 'bond')
})

test('결합선 수는 같고 차수만 올라가면 차수 증가 소리', () => {
  const before = board([{ a: 'a', b: 'b', order: 1 }])
  const after = board([{ a: 'a', b: 'b', order: 2 }])

  assert.equal(moveSound(before, after), 'bondUp')
})

test('결합 변화 없이 움직였으면 이동 소리', () => {
  const bonds: Bond[] = [{ a: 'a', b: 'b', order: 1 }]

  assert.equal(moveSound(board(bonds), board(bonds)), 'move')
})

test('벽에 연달아 박으면 막힘 소리를 건너뛴다', () => {
  const lastAt = new Map<SfxName, number>()

  assert.equal(allowPlay('blocked', 0, lastAt), true)
  assert.equal(allowPlay('blocked', 0.03, lastAt), false) // 키 연타 간격
  assert.equal(allowPlay('blocked', 0.2, lastAt), true) // 간격이 차면 다시 울린다
})

test('이동 소리는 연달아 울려도 막지 않는다', () => {
  const lastAt = new Map<SfxName, number>()

  assert.equal(allowPlay('move', 0, lastAt), true)
  assert.equal(allowPlay('move', 0.01, lastAt), true)
})

test('모든 효과음에 음이 하나 이상 들어 있다', () => {
  for (const [name, tones] of Object.entries(SOUNDS)) {
    assert.ok(tones.length > 0, `${name} 에 음이 없다`)
  }
})
