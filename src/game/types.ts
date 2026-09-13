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

// 결합선 — 두 원소 타일이 규칙에 맞게 인접했을 때 생기는 연결.
// order = 결합 차수 (1 단일, 2 이중, 3 삼중, 4 사중). 차수는 increaseBond()로만 올라간다.
export interface Bond {
  a: string
  b: string
  order: number
}

export interface Wall {
  row: number
  col: number
}

// 맵에 고정된 "+" 표시. 칸 사이(변)가 아니라 격자 모서리 — 네 칸이 만나는 꼭짓점에 놓인다.
// (row, col) = 그 칸의 좌측 상단 모서리. 옆으로 붙은 두 원자의 결합선이 이동하면서 이 점을
// 가로질러 지나갈 때만 반응한다. 모서리 옆에 그냥 붙어 있거나, 결합선 방향으로 미끄러져
// 지나가는 것은 통과가 아니다. 지나갈 때마다 매번 작동하므로 따로 기억할 상태가 없다.
export interface Bonder {
  row: number
  col: number
}

export interface Board {
  rows: number
  cols: number
  tiles: ElementTile[]
  bonds: Bond[]
  walls: Wall[]
  bonders: Bonder[]
  controlledId: string
}
