import type { LevelDef } from '../../types.ts'

// 형식만 있는 빈 템플릿 — 아래 값 채워서 실제 레벨로 교체할 것.
const level: LevelDef = {
  id: 'ch4-2',
  name: '',
  targetMolecule: '',
  explanation: '',
  moleculeName: '',
  moleculeExplanation: '',
  grid: {
    width: 7,
    height: 7,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
      [0, 1], [6, 1], [1, 1], [1, 2], [2, 1],
      [0, 2], [6, 2], [5, 1], [1, 5],
      [0, 3], [6, 3],
      [0, 4], [6, 4],
      [0, 5], [6, 5],
      [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
    ],
    bonders: [
      [4, 4],
    ]
  },

  atoms: [
    { id: 'O1', type: 'O', x: 5, y: 2, controlled: true },
    { id: 'O2', type: 'O', x: 1, y: 4},
    { id: 'C1', type: 'C', x: 3, y: 3},
    { id: 'C2', type: 'C', x: 5, y: 5},
  ],
}

export default level
