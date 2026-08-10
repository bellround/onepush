import type { Board, ElementTile, Bond, Direction, Wall } from './types.ts'

const STEP: Record<Direction, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
}

function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.rows && col >= 0 && col < board.cols
}

function isWall(board: Board, row: number, col: number): boolean {
  return board.walls.some((w) => w.row === row && w.col === col)
}

function tileAt(tiles: ElementTile[], row: number, col: number): ElementTile | undefined {
  return tiles.find((t) => t.row === row && t.col === col)
}

function bondKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

// 조작 원자와 결합으로 연결된 원자들 = 하나의 분자 그룹(강체로 취급)
function groupOf(board: Board, startId: string): Set<string> {
  const group = new Set([startId])
  let frontier = [startId]
  while (frontier.length > 0) {
    const next: string[] = []
    for (const id of frontier) {
      for (const bond of board.bonds) {
        const otherId = bond.a === id ? bond.b : bond.b === id ? bond.a : null
        if (otherId && !group.has(otherId)) {
          group.add(otherId)
          next.push(otherId)
        }
      }
    }
    frontier = next
  }
  return group
}

// 결합 조건: 두 원자가 인접하고, 각 원자의 남은 원자가가 1 이상일 때 결합선 생성.
// 이미 결합된 쌍은 다시 판정하지 않는다(끊어지지도 않는다).
// 한 원자가 남은 원자가보다 많은 상대와 동시에 인접하면(예: H 하나가 좌우 모두와 인접),
// 원자가가 더 큰 쪽(H보다 O처럼)을 먼저 결합시키고, 원자가가 같으면 더 오른쪽(열 값이 큰) 쪽을 먼저 결합시킨다.
export function detectBonds(board: Board): Board {
  const tiles = board.tiles.map((t) => ({ ...t }))
  const bonds: Bond[] = board.bonds.map((b) => ({ ...b }))
  const bonded = new Set(bonds.map((b) => bondKey(b.a, b.b)))

  const candidates: [ElementTile, ElementTile][] = []
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i]
      const b = tiles[j]
      const adjacent =
        (a.row === b.row && Math.abs(a.col - b.col) === 1) ||
        (a.col === b.col && Math.abs(a.row - b.row) === 1)
      if (!adjacent) continue
      if (bonded.has(bondKey(a.id, b.id))) continue
      candidates.push([a, b])
    }
  }

  candidates.sort((p1, p2) => {
    const maxValence1 = Math.max(p1[0].valence, p1[1].valence)
    const maxValence2 = Math.max(p2[0].valence, p2[1].valence)
    if (maxValence1 !== maxValence2) return maxValence2 - maxValence1
    const maxCol1 = Math.max(p1[0].col, p1[1].col)
    const maxCol2 = Math.max(p2[0].col, p2[1].col)
    return maxCol2 - maxCol1
  })

  for (const [a, b] of candidates) {
    if (a.remaining < 1 || b.remaining < 1) continue
    bonded.add(bondKey(a.id, b.id))
    bonds.push({ a: a.id, b: b.id })
    a.remaining -= 1
    b.remaining -= 1
  }

  return { ...board, tiles, bonds }
}

// 조작 그룹(startIds)을 direction으로 밀 때, 실제로 함께 움직여야 하는 타일 id 집합을 계산한다.
// - 진행 경로에 벽/보드 밖이 있으면 null(전체 이동 불가) 반환.
// - 진행 경로에 있는 그룹 밖 원자는 그 원자의 groupOf 전체를 밀림 집합에 편입시키고,
//   더 이상 새로 편입될 타일이 없을 때까지(고정점) 반복 확장한다.
// - 결합 가능 여부는 여기서 판단하지 않는다(순수 물리적 장애물 취급). 결합 판정은 호출부에서
//   이동 완료 후 detectBonds()로 처리한다.
function computePushGroup(
  board: Board,
  dr: number,
  dc: number,
  startIds: Set<string>,
): Set<string> | null {
  const movingIds = new Set(startIds)
  while (true) {
    const movingTiles = board.tiles.filter((t) => movingIds.has(t.id))

    for (const tile of movingTiles) {
      const row = tile.row + dr
      const col = tile.col + dc
      if (!inBounds(board, row, col) || isWall(board, row, col)) return null
    }

    let addedAny = false
    for (const tile of movingTiles) {
      const occupant = tileAt(board.tiles, tile.row + dr, tile.col + dc)
      if (occupant && !movingIds.has(occupant.id)) {
        for (const id of groupOf(board, occupant.id)) {
          if (!movingIds.has(id)) {
            movingIds.add(id)
            addedAny = true
          }
        }
      }
    }
    if (!addedAny) return movingIds
  }
}

// 조작 원자가 속한 분자 그룹 전체를 강체처럼 한 칸 민다.
// - 진행 방향의 1차 접촉(그룹 밖 원자)이 결합 가능(양쪽 remaining>=1)하면 이동은 하지 않고
//   그 자리에서 결합만 일어난다(기존 규칙 유지).
// - 1차 접촉이 결합 불가능하거나 접촉이 없으면 이동을 시도한다. 이때 진행 경로를 막는
//   그룹 밖 원자(및 그 원자의 분자 그룹)는 소코반처럼 함께 밀려나며, 연쇄적으로 더 막는
//   원자가 있으면 그 그룹까지 재귀적으로 포함해 판정한다(computePushGroup).
//   연쇄 경로 중 벽/보드 밖에 막히면 아무도 움직이지 않는다.
// - 이동이 끝나면 detectBonds()로 새로 인접한 원자들의 결합을 재판정한다.
export function pushTile(board: Board, direction: Direction): Board {
  const { dr, dc } = STEP[direction]
  const group = groupOf(board, board.controlledId)
  const groupTiles = board.tiles.filter((t) => group.has(t.id))

  const hasBondableContact = groupTiles.some((tile) => {
    const occupant = tileAt(board.tiles, tile.row + dr, tile.col + dc)
    return (
      occupant !== undefined &&
      !group.has(occupant.id) &&
      occupant.remaining >= 1 &&
      tile.remaining >= 1
    )
  })
  if (hasBondableContact) {
    return detectBonds(board)
  }

  const pushSet = computePushGroup(board, dr, dc, group)
  if (pushSet === null) {
    return board
  }

  const tiles = board.tiles.map((t) =>
    pushSet.has(t.id) ? { ...t, row: t.row + dr, col: t.col + dc } : t,
  )
  return detectBonds({ ...board, tiles })
}

// 클리어 조건: 판 위 모든 원자가 하나의 그룹으로 결합되고, 모든 원자가 자리가 채워졌을 때.
export function isCleared(board: Board): boolean {
  if (board.tiles.length === 0) return false
  if (!board.tiles.every((t) => t.remaining === 0)) return false
  return groupOf(board, board.tiles[0].id).size === board.tiles.length
}

export function createBoard(
  rows: number,
  cols: number,
  tiles: ElementTile[],
  controlledId: string,
  walls: Wall[] = [],
): Board {
  return detectBonds({ rows, cols, tiles, bonds: [], walls, controlledId })
}
