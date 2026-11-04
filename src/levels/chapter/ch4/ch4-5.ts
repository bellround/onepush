import type { LevelDef } from '../../types.ts'

// 형식만 있는 빈 템플릿 — 아래 값 채워서 실제 레벨로 교체할 것.
const level: LevelDef = {
  id: 'ch4-5',
  name: '냄새나(CH₃COOH)',
  targetMolecule: '아세트산(CH₃COOH)',
  explanation: '아세트산은 강한 자극적인 냄새가 난다.',
  moleculeName: '아세트산(CH₃COOH)',
  moleculeExplanation: '탄소 2개, 수소 4개, 산소 2개가 붙어서 생긴 분자',
  grid: {
    width: 8,
    height: 8,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0],
      [0, 1], [1, 1], [7, 1],
      [0, 2], [1, 2], [7, 2],
      [0, 3], [1, 3], [7, 3],
      [0, 4], [7, 4],
      [0, 5], [7, 5],
      [0, 6], [4, 6], [5, 6], [6,6], [7, 6],
      [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7],
    ],
    bonders: [
      [4, 4],
    ]
  },

  atoms: [
    { id: 'C1', type: 'C', x: 2, y: 5, controlled: true },
    { id: 'C2', type: 'C', x: 4, y: 3},
    { id: 'H1', type: 'H', x: 1, y: 5},
    { id: 'H2', type: 'H', x: 2, y: 6},
    { id: 'H3', type: 'H', x: 2, y: 3},
    { id: 'H4', type: 'H', x: 4, y: 5},
    { id: 'O1', type: 'O', x: 3, y: 1},
    { id: 'O2', type: 'O', x: 6, y: 3},
  ],
}

export default level
