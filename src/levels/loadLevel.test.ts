/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pushTile, isCleared } from '../game/board.ts'
import { loadLevel } from './loadLevel.ts'
import type { Board, Direction } from '../game/types.ts'
import type { LevelDef } from './types.ts'
import ch1_1 from './ch1-1-h2.ts'
import ch1_2 from './ch1-2-water.ts'
import ch1_3 from './ch1-3-detour.ts'
import ch1_4 from './ch1-4-full-hands.ts'
import ch1_5 from './ch1-5-new-varity.ts'

// index.ts는 import.meta.glob(Vite 전용 API)로 레벨을 모으기 때문에 node --test로 직접 실행할 수 없다.
// 그래서 여기서는 각 레벨 파일을 직접 import한다.
const LEVELS: LevelDef[] = [ch1_1, ch1_2, ch1_3, ch1_4, ch1_5]

test('등록된 모든 레벨이 에러 없이 로드된다', () => {
  for (const def of LEVELS) {
    const { board } = loadLevel(def)
    assert.ok(board.tiles.some((t) => t.id === board.controlledId), `${def.id}: controlled 원자 없음`)
    assert.equal(board.tiles.length, def.atoms.length, `${def.id}: 원자 수 불일치`)
  }
})

function play(def: LevelDef, moves: Direction[]): Board {
  let { board } = loadLevel(def)
  for (const move of moves) {
    board = pushTile(board, move)
  }
  return board
}

test('ch1-1: 물(H2O) 완성', () => {
  const board = play(ch1_1, ['up', 'up', 'right', 'right', 'up', 'up', 'right', 'right'])
  assert.equal(board.bonds.length, 2)
  assert.ok(isCleared(board))
})

test('ch1-2: 물(H2O) 완성', () => {
  const board = play(ch1_2, ['right', 'up', 'right', 'right', 'left', 'left'])
  assert.equal(board.bonds.length, 2)
  assert.ok(isCleared(board))
})

test('ch1-3: 과산화수소(H2O2) 완성', () => {
  const board = play(ch1_3, [
    'up', 'up', 'right', 'right', 'down', 'down', 'up', 'up',
    'left', 'left', 'left', 'down', 'down', 'down', 'down', 'right',
  ])
  assert.equal(board.bonds.length, 3)
  assert.ok(isCleared(board))
})

test('ch1-4: NH2OH 완성', () => {
  const board = play(ch1_4, ['up', 'up', 'left', 'left', 'down', 'left', 'down', 'down', 'left', 'left'])
  assert.equal(board.bonds.length, 4)
  assert.ok(isCleared(board))
})

test('ch1-5: 메탄올(CH3OH) 완성', () => {
  const board = play(ch1_5, [
    'down', 'down', 'right', 'right', 'up', 'right', 'right',
    'down', 'left', 'left', 'up', 'up', 'left',
  ])
  assert.equal(board.bonds.length, 5)
  assert.ok(isCleared(board))
})
