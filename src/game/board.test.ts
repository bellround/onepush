/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBoard, isCleared, pushTile } from './board.ts'
import { createTile } from './elements.ts'
import type { ElementTile } from './types.ts'

function find(tiles: ElementTile[], symbol: string): ElementTile {
  const t = tiles.find((t) => t.symbol === symbol)
  if (!t) throw new Error(`${symbol} 없음`)
  return t
}

function positions(tiles: ElementTile[]) {
  return tiles.map((t) => [t.row, t.col])
}

test('인접 + 남은 원자가 있으면 초기 배치에서 바로 결합', () => {
  const h = createTile('H', 0, 0)
  const o = createTile('O', 0, 1)
  const board = createBoard(3, 3, [h, o], h.id)

  assert.equal(board.bonds.length, 1)
  assert.equal(find(board.tiles, 'H').remaining, 0)
  assert.equal(find(board.tiles, 'O').remaining, 1)
})

test('빈 칸으로는 조작 원자가 1칸 이동', () => {
  const h = createTile('H', 1, 1)
  const board = createBoard(3, 3, [h], h.id)

  const moved = pushTile(board, 'right')
  assert.equal(find(moved.tiles, 'H').col, 2)
  assert.equal(find(moved.tiles, 'H').row, 1)
})

test('벽으로 밀면 이동 불가', () => {
  const h = createTile('H', 1, 0)
  const board = createBoard(3, 3, [h], h.id, [{ row: 1, col: 1 }])

  const moved = pushTile(board, 'right')
  assert.equal(find(moved.tiles, 'H').col, 0)
})

test('보드 밖으로는 이동 불가', () => {
  const h = createTile('H', 0, 0)
  const board = createBoard(3, 3, [h], h.id)

  const moved = pushTile(board, 'up')
  assert.equal(find(moved.tiles, 'H').row, 0)
})

test('원자가가 이미 다 찬 원자 방향으로 밀면 결합도 이동도 없이 정지', () => {
  const h1 = createTile('H', 1, 0)
  const h2 = createTile('H', 1, 1)
  const board = createBoard(3, 3, [h1, h2], h1.id) // 인접 -> 즉시 결합, 둘 다 remaining 0

  const h3 = createTile('H', 1, 2) // 그룹 밖의 세 번째 H (아직 미배치 상태로 추가)
  const withH3 = { ...board, tiles: [...board.tiles, h3] }

  const moved = pushTile(withH3, 'right')
  assert.equal(moved.bonds.length, 1) // 새 결합 없음 (h2 remaining 0)
  assert.deepEqual(positions(moved.tiles), positions(withH3.tiles)) // 아무도 움직이지 않음
})

test('결합된 그룹은 강체로 함께 이동한다', () => {
  const h = createTile('H', 2, 0)
  const o = createTile('O', 2, 1)
  const board = createBoard(3, 5, [h, o], h.id) // 초기 인접 -> 결합

  const moved = pushTile(board, 'right')
  assert.equal(find(moved.tiles, 'H').col, 1)
  assert.equal(find(moved.tiles, 'O').col, 2)
})

test('그룹이 벽에 막히면 전체 이동 불가', () => {
  const h = createTile('H', 2, 0)
  const o = createTile('O', 2, 1)
  const board = createBoard(3, 3, [h, o], h.id, [{ row: 2, col: 2 }])

  const moved = pushTile(board, 'right')
  assert.deepEqual(positions(moved.tiles), positions(board.tiles))
})

test('기획서 9번 표 물방울(H2O) 예시: 두 번 밀면 분자 완성', () => {
  const h1 = createTile('H', 2, 0) // controlled
  const o = createTile('O', 2, 2)
  const h2 = createTile('H', 2, 4)
  const board = createBoard(5, 5, [h1, o, h2], h1.id, [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: 4 },
    { row: 1, col: 4 },
  ])
  assert.equal(board.bonds.length, 0)

  const afterFirst = pushTile(board, 'right') // H1이 O 옆으로 이동하며 즉시 결합
  assert.equal(afterFirst.bonds.length, 1)
  assert.equal(find(afterFirst.tiles, 'O').remaining, 1)

  const afterSecond = pushTile(afterFirst, 'right') // 결합된 그룹(H1+O)이 함께 이동, O가 두 번째 H와 인접
  assert.equal(afterSecond.bonds.length, 2)
  assert.equal(find(afterSecond.tiles, 'O').remaining, 0)
})

test('isCleared: 원자가 남았으면 미완성', () => {
  const h = createTile('H', 0, 0)
  const o = createTile('O', 0, 1) // H-O 결합, O는 remaining 1 남음
  const board = createBoard(3, 3, [h, o], h.id)
  assert.equal(isCleared(board), false)
})

test('isCleared: 모두 결합 완료 + 하나의 그룹이면 클리어', () => {
  const h1 = createTile('H', 0, 0)
  const o = createTile('O', 0, 1)
  const h2 = createTile('H', 0, 2)
  const board = createBoard(3, 3, [h1, o, h2], h1.id) // 초기 배치부터 H-O-H 완성
  assert.equal(isCleared(board), true)
})

test('isCleared: 원자가는 다 찼지만 그룹이 둘로 나뉘면 미완성', () => {
  const h1 = createTile('H', 0, 0)
  const h2 = createTile('H', 0, 1) // 첫 번째 H2, 서로 결합해 remaining 0
  const h3 = createTile('H', 2, 0)
  const h4 = createTile('H', 2, 1) // 두 번째 H2, 별개 그룹
  const board = createBoard(3, 3, [h1, h2, h3, h4], h1.id)
  assert.equal(isCleared(board), false)
})
