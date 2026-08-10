import type { LevelDef } from '../../types.ts'

// 형식만 있는 빈 템플릿 — 아래 값 채워서 실제 레벨로 교체할 것.
const level: LevelDef = {
  id: 'ch2-5',
  name: '',
  targetMolecule: '',
  explanation: '',
  moleculeName: '',
  moleculeExplanation: '',
  grid: {
    width: 7,
    height: 9,
    walls: [
      [0, 0],
      [0, 8],
      [1, 0],
      [1, 8],
      [2, 0],
      [2, 8],
      [3, 0],
      [3, 8],
      [4, 0],
      [4, 8],
      [5, 0],
      [5, 8],
      [6, 0],
      [6, 8],
      [0, 1],
      [6, 1],
      [0, 2],
      [6, 2],
      [0, 3],
      [6, 3],
      [0, 4],
      [6, 4],
      [0, 5],
      [6, 5],
      [0, 6],
      [6, 6],
      [0, 7],
      [6, 7],
      [3, 1],
      [3, 7],
    ],
  },

  atoms: [
    { id: 'c1', type: 'C', x: 3, y: 4, controlled: true },
    { id: 'h1', type: 'H', x: 1, y: 2 },
    { id: 'h2', type: 'H', x: 5, y: 2 },
    { id: 'h3', type: 'H', x: 1, y: 6 },
    { id: 'h4', type: 'H', x: 5, y: 6 },
    { id: 'o1', type: 'O', x: 3, y: 2 },
    { id: 'o2', type: 'O', x: 3, y: 6 },
  ],
}

export default level
