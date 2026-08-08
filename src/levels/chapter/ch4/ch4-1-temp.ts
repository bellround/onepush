import type { LevelDef } from '../../types.ts'

// 형식만 있는 빈 템플릿 — 아래 값 채워서 실제 레벨로 교체할 것.
const level: LevelDef = {
  id: 'ch4-1',
  name: '',
  targetMolecule: '',
  explanation: '',
  moleculeName: '',
  moleculeExplanation: '',
  grid: {
    width: 0,
    height: 0,
    walls: [
      // [x, y],
    ],
  },

  atoms: [
    // { id: 'x1', type: 'H', x: 0, y: 0, controlled: true },
  ],
}

export default level
