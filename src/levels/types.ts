// 기획서 9번 표 JSON 레벨 포맷 그대로.
export interface LevelAtomDef {
  id: string
  type: string
  x: number
  y: number
  controlled?: boolean
}

export interface LevelDef {
  id: string
  name: string
  targetMolecule: string
  grid: {
    width: number
    height: number
    walls?: [number, number][] // [x, y]
    // 결합 차수를 올려주는 + 표시. [x, y] — (x, y) 칸의 좌측 상단 격자 모서리(꼭짓점).
    bonders?: [number, number][]
  }
  atoms: LevelAtomDef[]
  explanation?: string // 클리어 팝업에 표시할 해설 2~3문장 — 콘텐츠는 추후 작성
  moleculeName: string // 분자 도감에 표시할 분자 이름
  moleculeExplanation?: string // 분자 도감에 표시할 설명 — 콘텐츠는 추후 작성
}
