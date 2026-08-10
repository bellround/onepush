import type { LevelDef } from '../../types.ts'

// 형식만 있는 빈 템플릿 — 아래 값 채워서 실제 레벨로 교체할 것.
const level: LevelDef = {
  id: 'ch2-3',
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
      [1, 1],
      [5, 1],
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
    ],
  },

  atoms: [
    { id: 'h1', type: 'H', x: 3, y: 1, controlled: true },
    { id: 'h2', type: 'H', x: 1, y: 3 },
    { id: 'h3', type: 'H', x: 5, y: 3 },
    { id: 'h4', type: 'H', x: 5, y: 5 },
    { id: 'h5', type: 'H', x: 1, y: 5 },
    { id: 'h6', type: 'H', x: 3, y: 7 },
    { id: 'o1', type: 'O', x: 3, y: 3 },
    { id: 'c1', type: 'C', x: 2, y: 5 },
    { id: 'c2', type: 'C', x: 4, y: 5 },

  ],
}

export default level
