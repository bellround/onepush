import type { LevelDef } from '../../types.ts'

// 형식만 있는 빈 템플릿 — 아래 값 채워서 실제 레벨로 교체할 것.
const level: LevelDef = {
  id: 'ch4-4',
  name: '프로틴인가(C₃H₄)',
  targetMolecule: '프로핀(C₃H₄)',
  explanation: '프로핀은 산소가 없어도 압력과 온도가 높을때 혼자서 폭발할 수 있다.',
  moleculeName: '프로핀(C₃H₄)',
  moleculeExplanation: '탄소 3개와 수소 4개가 붙어서 생긴 분자',
  grid: {
    width: 9,
    height: 8,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0],
      [0, 1], [8, 1],
      [0, 2], [8, 2],
      [0, 3], [8, 3],
      [0, 4], [8, 4],
      [0, 5], [8, 5],
      [0, 6], [1, 6], [2, 6], [6, 6], [7, 6], [8, 6],
      [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7],
    ],
    bonders: [
      [4, 6], [5, 6]
    ]
  },

  atoms: [
    { id: 'C1', type: 'C', x: 4, y: 3, controlled: true },
    { id: 'C2', type: 'C', x: 7, y: 3},
    { id: 'C3', type: 'C', x: 1, y: 3},
    { id: 'H1', type: 'H', x: 2, y: 1},
    { id: 'H2', type: 'H', x: 6, y: 1},
    { id: 'H3', type: 'H', x: 2, y: 5},
    { id: 'H4', type: 'H', x: 6, y: 5},
  ],
}

export default level
