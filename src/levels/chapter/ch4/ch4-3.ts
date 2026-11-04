import type { LevelDef } from '../../types.ts'

// 형식만 있는 빈 템플릿 — 아래 값 채워서 실제 레벨로 교체할 것.
const level: LevelDef = {
  id: 'ch4-3',
  name: '전부등장함(HOCN)',
  targetMolecule: '사이안산(HOCN)',
  explanation: '사이안산은 분자 내부에서 수소가 이동하면 다른분자로 바뀌는 특이한 특징을 가진다.',
  moleculeName: '사이안산(HOCN)',
  moleculeExplanation: '수소 1개, 산소 1개, 탄소 1개, 질소 1개가 붙어서 생긴 분자',
  grid: {
    width: 10,
    height: 9,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
      [0, 1], [9, 1],
      [0, 2], [9, 2],
      [0, 3], [9, 3],
      [0, 4], [2, 4], [3, 4], [7, 4], [6, 4], [9, 4],
      [0, 5], [9, 5],
      [0, 6], [9, 6],
      [0, 7], [9, 7],
      [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8],
    ],
    bonders: [
      [5, 4]
    ]
  },

  atoms: [
    { id: 'N1', type: 'N', x: 6, y: 2},
    { id: 'H1', type: 'H', x: 3, y: 6, controlled: true },
    { id: 'C1', type: 'C', x: 3, y: 2},
    { id: 'O1', type: 'O', x: 6, y: 6},
  ],
}

export default level
