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
  }
  atoms: LevelAtomDef[]
  explanation?: string // 클리어 팝업에 표시할 해설 2~3문장 — 콘텐츠는 추후 작성
}
