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
export function detectBonds(board: Board): Board {
  const tiles = board.tiles.map((t) => ({ ...t }))
  const bonds: Bond[] = board.bonds.map((b) => ({ ...b }))
  const bonded = new Set(bonds.map((b) => bondKey(b.a, b.b)))

  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i]
      const b = tiles[j]
      const adjacent =
        (a.row === b.row && Math.abs(a.col - b.col) === 1) ||
        (a.col === b.col && Math.abs(a.row - b.row) === 1)
      if (!adjacent) continue

      const key = bondKey(a.id, b.id)
      if (bonded.has(key)) continue
      if (a.remaining < 1 || b.remaining < 1) continue

      bonded.add(key)
      bonds.push({ a: a.id, b: b.id })
      a.remaining -= 1
      b.remaining -= 1
    }
  }

  return { ...board, tiles, bonds }
}

// 조작 원자가 속한 분자 그룹 전체를 강체처럼 한 칸 민다.
// - 진행 방향에 벽/보드 밖이 있으면 그룹 전체 이동 불가, 결합 판정도 없음.
// - 진행 방향에 그룹 밖 원자가 있으면 실제로는 이동하지 않고(칸을 밀고 들어가지 않음),
//   이미 인접해 있는 상태이므로 결합 조건만 판정한다 — 맞으면 그 자리에서 결합, 안 맞으면 그대로 정지.
export function pushTile(board: Board, direction: Direction): Board {
  const { dr, dc } = STEP[direction]
  const group = groupOf(board, board.controlledId)
  const groupTiles = board.tiles.filter((t) => group.has(t.id))

  for (const tile of groupTiles) {
    const row = tile.row + dr
    const col = tile.col + dc
    if (!inBounds(board, row, col) || isWall(board, row, col)) {
      return board
    }
  }

  const hasForeignBlock = groupTiles.some((tile) => {
    const occupant = tileAt(board.tiles, tile.row + dr, tile.col + dc)
    return occupant !== undefined && !group.has(occupant.id)
  })

  if (hasForeignBlock) {
    return detectBonds(board)
  }

  const tiles = board.tiles.map((t) =>
    group.has(t.id) ? { ...t, row: t.row + dr, col: t.col + dc } : t,
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
