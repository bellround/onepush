export type Direction = 'up' | 'down' | 'left' | 'right'

// 원소 타일 — 보드 위에서 미는 대상
export interface ElementTile {
  id: string
  symbol: string
  valence: number // 초기 원자가전자 수
  remaining: number // 남은 원자가전자 수
  row: number
  col: number
}

// 결합선 — 두 원소 타일이 규칙에 맞게 인접했을 때 생기는 연결
export interface Bond {
  a: string
  b: string
}

export interface Wall {
  row: number
  col: number
}

export interface Board {
  rows: number
  cols: number
  tiles: ElementTile[]
  bonds: Bond[]
  walls: Wall[]
  controlledId: string
}
