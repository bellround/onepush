// 기획서 3.2 원자가 매핑 표 그대로. 나머지 원소는 필요해질 때 추가.
export const ELEMENT_VALENCE: Record<string, number> = {
  H: 1,
  O: 2,
  N: 3,
  C: 4,
  Cl: 1,
  Na: 1,
}

let nextId = 0

export function createTile(symbol: string, row: number, col: number): import('./types.ts').ElementTile {
  const valence = ELEMENT_VALENCE[symbol]
  if (valence === undefined) {
    throw new Error(`알 수 없는 원소: ${symbol}`)
  }
  return {
    id: `${symbol}-${nextId++}`,
    symbol,
    valence,
    remaining: valence,
    row,
    col,
  }
}
