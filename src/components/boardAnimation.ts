export type Position = { id: string; row: number; col: number }
export const MOVE_MS = 120

// CSS ease is cubic-bezier(0.25, 0.1, 0.25, 1); solve its x for time.
function ease(progress: number) {
  let low = 0
  let high = 1
  for (let i = 0; i < 24; i++) {
    const t = (low + high) / 2
    const x = 0.75 * (1 - t) * t + t ** 3
    if (x < progress) low = t
    else high = t
  }
  const t = (low + high) / 2
  return 0.3 * (1 - t) ** 2 * t + 3 * (1 - t) * t ** 2 + t ** 3
}

export function interpolatePositions(from: Position[], to: Position[], elapsed: number): Position[] {
  const progress = Math.max(0, Math.min(1, elapsed / MOVE_MS))
  const amount = progress === 0 || progress === 1 ? progress : ease(progress)
  return to.map((target) => {
    const start = from.find((position) => position.id === target.id) ?? target
    return {
      id: target.id,
      row: start.row + (target.row - start.row) * amount,
      col: start.col + (target.col - start.col) * amount,
    }
  })
}
