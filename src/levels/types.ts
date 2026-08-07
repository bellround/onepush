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
}
