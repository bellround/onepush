import type { LevelDef } from '../../types.ts'

// 임시 레벨 — ch1-1과 동일 구조. 챕터2 실제 레벨로 교체 예정.
const level: LevelDef = {
  id: 'ch2-1',
  name: '(임시) 챕터2',
  targetMolecule: '물(H2O)',
  grid: {
    width: 7,
    height: 6,
    walls: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [4, 5],
      [5, 5],
      [6, 5],
      [4, 3],
      [4, 2],
    ],
  },

  atoms: [
    { id: 'h1', type: 'H', x: 1, y: 4, controlled: true },
    { id: 'o1', type: 'O', x: 3, y: 3 },
    { id: 'h2', type: 'H', x: 5, y: 2 },
  ],
}

export default level
