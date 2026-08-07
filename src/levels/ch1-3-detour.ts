import type { LevelDef } from './types.ts'

const level: LevelDef = {
  id: 'ch1-3',
  name: '반복',
  targetMolecule: '과산화수소(H2O2)',
  grid: {
    width: 7,
    height: 7,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
      [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
      [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
      [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
      [3, 2], [3, 3], [3, 4]
    ],
  },
  atoms: [
    { id: 'h1', type: 'H', x: 2, y: 3, controlled: true },
    { id: 'o1', type: 'O', x: 3, y: 1 },
    { id: 'h2', type: 'H', x: 4, y: 3 },
    { id: 'o2', type: 'O', x: 3, y: 5 },
  ],
}

export default level
