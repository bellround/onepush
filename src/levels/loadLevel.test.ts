/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pushTile } from '../game/board.ts'
import { LEVELS, loadLevel } from './index.ts'
import type { Board, Direction } from '../game/types.ts'

test('등록된 모든 레벨이 에러 없이 로드된다', () => {
  for (const def of LEVELS) {
    const { board } = loadLevel(def)
    assert.ok(board.tiles.some((t) => t.id === board.controlledId), `${def.id}: controlled 원자 없음`)
    assert.equal(board.tiles.length, def.atoms.length, `${def.id}: 원자 수 불일치`)
  }
})

function play(levelId: string, moves: Direction[]): Board {
  const def = LEVELS.find((l) => l.id === levelId)
  if (!def) throw new Error(`${levelId} 없음`)
  let { board } = loadLevel(def)
  for (const move of moves) {
    board = pushTile(board, move)
  }
  return board
}

function allSatisfied(board: Board): boolean {
  return board.tiles.every((t) => t.remaining === 0)
}

test('ch1-1: 한 번 밀면 H2 완성', () => {
  const board = play('ch1-1', ['right'])
  assert.equal(board.bonds.length, 1)
  assert.ok(allSatisfied(board))
})

test('ch1-2: 한 번 밀면 H2O 완성', () => {
  const board = play('ch1-2', ['right'])
  assert.equal(board.bonds.length, 2)
  assert.ok(allSatisfied(board))
})

test('ch1-3: 벽 돌아서 H2O 완성', () => {
  const board = play('ch1-3', ['up', 'right', 'right', 'down', 'right', 'right'])
  assert.equal(board.bonds.length, 2)
  assert.ok(allSatisfied(board))
})

test('ch1-4: 긴 벽 돌아서 H2O 완성', () => {
  const board = play('ch1-4', ['up', 'right', 'right', 'right', 'down', 'right', 'right'])
  assert.equal(board.bonds.length, 2)
  assert.ok(allSatisfied(board))
})
