/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBoard, increaseBond, isCleared, pushTile } from './board.ts'
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

function findById(tiles: ElementTile[], id: string): ElementTile {
  const t = tiles.find((t) => t.id === id)
  if (!t) throw new Error(`id 없음: ${id}`)
  return t
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

test('밀려날 자리가 보드 밖이면 결합도 이동도 없이 정지', () => {
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

test('결합 불가 상태에서 단일 원자를 밀면 밀려난다', () => {
  const h1 = createTile('H', 1, 0)
  const h2 = createTile('H', 1, 1)
  const board = createBoard(3, 6, [h1, h2], h1.id) // 인접 -> 즉시 결합, 둘 다 remaining 0

  const h3 = createTile('H', 1, 2) // 그룹 밖의 세 번째 H, 아직 미결합
  const withH3 = { ...board, tiles: [...board.tiles, h3] }

  const moved = pushTile(withH3, 'right')
  assert.equal(findById(moved.tiles, h1.id).col, 1)
  assert.equal(findById(moved.tiles, h2.id).col, 2)
  assert.equal(findById(moved.tiles, h3.id).col, 3)
  assert.equal(moved.bonds.length, 1) // 새 결합 없음 (h2 remaining 0)
})

test('상대 바로 뒤에 벽이 있어 못 미는 경우', () => {
  const h1 = createTile('H', 1, 0)
  const h2 = createTile('H', 1, 1)
  const board = createBoard(3, 5, [h1, h2], h1.id, [{ row: 1, col: 3 }])

  const h3 = createTile('H', 1, 2)
  const withH3 = { ...board, tiles: [...board.tiles, h3] }

  const moved = pushTile(withH3, 'right')
  assert.deepEqual(positions(moved.tiles), positions(withH3.tiles)) // 아무도 움직이지 않음
  assert.equal(moved.bonds.length, 1)
})

test('상대가 결합된 그룹이면 그룹째 밀린다', () => {
  const h1 = createTile('H', 1, 0)
  const h2 = createTile('H', 1, 1)
  const h3 = createTile('H', 1, 2)
  const h4 = createTile('H', 1, 3)
  const board = createBoard(3, 6, [h1, h2, h3, h4], h1.id)
  // h1-h2, h3-h4 각각 결합 (h2-h3 사이는 h2가 remaining 0이라 결합 안 됨)
  assert.equal(board.bonds.length, 2)

  const moved = pushTile(board, 'right')
  assert.equal(findById(moved.tiles, h1.id).col, 1)
  assert.equal(findById(moved.tiles, h2.id).col, 2)
  assert.equal(findById(moved.tiles, h3.id).col, 3)
  assert.equal(findById(moved.tiles, h4.id).col, 4)
  assert.equal(moved.bonds.length, 2) // 기존 두 결합 그대로, 새 결합 없음
})

test('상대 뒤에 제3의 원자가 있고 그 뒤가 벽이라 연쇄가 막히는 경우', () => {
  const h1 = createTile('H', 1, 0)
  const h2 = createTile('H', 1, 1)
  const board = createBoard(3, 5, [h1, h2], h1.id, [{ row: 1, col: 4 }])

  const h3 = createTile('H', 1, 2)
  h3.remaining = 0 // 부수적 결합 방지, 순수 이동 로직만 검증
  const h5 = createTile('H', 1, 3)
  h5.remaining = 0
  const withExtra = { ...board, tiles: [...board.tiles, h3, h5] }

  const moved = pushTile(withExtra, 'right')
  assert.deepEqual(positions(moved.tiles), positions(withExtra.tiles)) // 아무도 움직이지 않음
  assert.equal(moved.bonds.length, 1)
})

test('상대 뒤에 제3의 원자가 있어도 그 뒤에 공간이 있으면 연쇄 전체가 밀린다', () => {
  const h1 = createTile('H', 1, 0)
  const h2 = createTile('H', 1, 1)
  const board = createBoard(3, 6, [h1, h2], h1.id)

  const h3 = createTile('H', 1, 2)
  h3.remaining = 0
  const h5 = createTile('H', 1, 3)
  h5.remaining = 0
  const withExtra = { ...board, tiles: [...board.tiles, h3, h5] }

  const moved = pushTile(withExtra, 'right')
  assert.equal(findById(moved.tiles, h1.id).col, 1)
  assert.equal(findById(moved.tiles, h2.id).col, 2)
  assert.equal(findById(moved.tiles, h3.id).col, 3)
  assert.equal(findById(moved.tiles, h5.id).col, 4)
  assert.equal(moved.bonds.length, 1)
})

test('결합 가능한 상대는 밀리지 않고 제자리에서 결합만 된다 (회귀 테스트)', () => {
  const h = createTile('H', 1, 0)
  const board = createBoard(3, 5, [h], h.id)
  const o = createTile('O', 1, 1) // 미결합
  const withO = { ...board, tiles: [...board.tiles, o] }

  const moved = pushTile(withO, 'right')
  assert.equal(findById(moved.tiles, h.id).col, 0)
  assert.equal(findById(moved.tiles, o.id).col, 1)
  assert.equal(moved.bonds.length, 1) // 새 결합 생김
  assert.equal(findById(moved.tiles, h.id).remaining, 0)
  assert.equal(findById(moved.tiles, o.id).remaining, 1)
})

test('결합된 두 원자에 남은 원자가가 있으면 차수를 올려 이중·삼중 결합이 된다', () => {
  const o1 = createTile('O', 0, 0)
  const o2 = createTile('O', 0, 1)
  const board = createBoard(3, 3, [o1, o2], o1.id)

  // 붙자마자 단일 결합 — 각자 원자가 2 중 1을 썼다.
  assert.equal(board.bonds.length, 1)
  assert.equal(board.bonds[0].order, 1)
  assert.equal(find(board.tiles, 'O').remaining, 1)

  const double = increaseBond(board, o1.id, o2.id)
  assert.equal(double.bonds.length, 1) // 선 개수가 아니라 차수가 오른다
  assert.equal(double.bonds[0].order, 2)
  assert.equal(findById(double.tiles, o1.id).remaining, 0)
  assert.equal(findById(double.tiles, o2.id).remaining, 0)
  assert.equal(isCleared(double), true)
})

test('남은 원자가가 없으면 차수가 오르지 않는다', () => {
  const o1 = createTile('O', 0, 0)
  const o2 = createTile('O', 0, 1)
  const board = createBoard(3, 3, [o1, o2], o1.id)
  const double = increaseBond(board, o1.id, o2.id)

  assert.equal(increaseBond(double, o1.id, o2.id), double) // 그대로 반환
})

test('삼중 결합까지 올라가고, 결합되지 않은 쌍은 차수를 올릴 수 없다', () => {
  const n1 = createTile('N', 0, 0)
  const n2 = createTile('N', 0, 1)
  const far = createTile('H', 2, 2)
  const board = createBoard(3, 3, [n1, n2, far], n1.id)

  const triple = increaseBond(increaseBond(board, n1.id, n2.id), n1.id, n2.id)
  assert.equal(triple.bonds[0].order, 3)
  assert.equal(findById(triple.tiles, n1.id).remaining, 0)

  assert.equal(increaseBond(board, n1.id, far.id), board) // 결합선이 없는 쌍
})

// 맵에 고정된 + 표시(bonder): 격자 모서리에 놓이고, 옆으로 붙은 결합선이 이동하면서
// 그 점을 가로질러 지나갈 때만 차수가 오른다. 옆에 붙어 있기만 해서는 오르지 않는다.
//
// 칸 (1,1)-(1,2)의 가로 결합선은 중점이 열 2 위에 있다. 아래로 한 칸 움직이면
// 중점의 행이 1.5 에서 2.5 로 가면서 모서리 (행 2, 열 2)를 가로지른다.
const BONDER = { row: 2, col: 2 }

function carbonPair() {
  const c1 = createTile('C', 1, 1)
  const c2 = createTile('C', 1, 2)
  return { c1, c2, board: createBoard(4, 4, [c1, c2], c1.id, [], [BONDER]) }
}

test('결합선이 + 모서리를 가로질러 지나가면 차수가 오른다', () => {
  const { c1, c2, board } = carbonPair()

  assert.equal(board.bonds[0].order, 1) // 처음엔 그냥 단일결합
  assert.equal(findById(board.tiles, c1.id).remaining, 3)

  const down = pushTile(board, 'down')
  assert.equal(down.bonds[0].order, 2) // 지나가면서 이중결합
  assert.equal(findById(down.tiles, c1.id).remaining, 2)
  assert.equal(findById(down.tiles, c2.id).remaining, 2)
})

test('지나갈 때마다 매번 오른다', () => {
  const { c1, board } = carbonPair()

  const triple = pushTile(pushTile(board, 'down'), 'up')
  assert.equal(triple.bonds[0].order, 3)

  const quad = pushTile(triple, 'down')
  assert.equal(quad.bonds[0].order, 4) // 사중결합, 탄소 원자가 4 소진
  assert.equal(findById(quad.tiles, c1.id).remaining, 0)
  assert.equal(isCleared(quad), true)

  // 원자가가 남지 않았으면 다시 지나가도 오르지 않는다.
  assert.equal(pushTile(quad, 'up').bonds[0].order, 4)
})

test('모서리 옆에 붙어 있기만 하면 오르지 않는다', () => {
  const { board } = carbonPair()

  // 결합선 방향(가로)으로 미끄러지면 모서리 점을 가로지르지 않는다.
  assert.equal(pushTile(board, 'right').bonds[0].order, 1)
  assert.equal(pushTile(board, 'left').bonds[0].order, 1)
})

test('세로 결합선은 가로로 지나가야 오른다', () => {
  // 칸 (1,1)-(2,1)의 세로 결합선은 중점이 행 2 위에 있다.
  // 오른쪽으로 한 칸 가면 중점의 열이 1.5 에서 2.5 로 가며 모서리 (2,2)를 가로지른다.
  const c1 = createTile('C', 1, 1)
  const c2 = createTile('C', 2, 1)
  const board = createBoard(4, 4, [c1, c2], c1.id, [], [BONDER])

  assert.equal(board.bonds[0].order, 1)
  assert.equal(pushTile(board, 'right').bonds[0].order, 2)
  assert.equal(pushTile(board, 'down').bonds[0].order, 1) // 결합선 방향으로 미끄러짐
})

test('+ 표시가 없으면 차수가 오르지 않는다', () => {
  const c1 = createTile('C', 1, 1)
  const c2 = createTile('C', 1, 2)
  const board = createBoard(4, 4, [c1, c2], c1.id)

  assert.equal(pushTile(board, 'down').bonds[0].order, 1)
})
