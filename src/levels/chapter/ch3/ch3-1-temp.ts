import type { LevelDef } from '../../types.ts'

const level: LevelDef = {
  id: 'ch3-1',
  name: '',
  targetMolecule: '',
  explanation: '',
  moleculeName: '',
  moleculeExplanation: '',
  grid: {
    width: 9,
    height: 7,
    walls: [
      [0, 0],
      [0, 6],
      [1, 0],
      [1, 6],
      [2, 0],
      [2, 6],
      [3, 0],
      [3, 6],
      [4, 0],
      [4, 6],
      [5, 0],
      [5, 6],
      [6, 0],
      [6, 6],
      [7, 0],
      [7, 6],
      [8, 0],
      [8, 6],
      [0, 1],
      [8, 1],
      [0, 2],
      [8, 2],
      [0, 3],
      [8, 3],
      [0, 4],
      [8, 4],
      [0, 5],
      [8, 5],
    ],
  },

  atoms: [
    { id: 'He1', type: 'He', x: 1, y: 1, controlled: true },
    { id: 'o1', type: 'O', x: 3, y: 3 },
    { id: 'h2', type: 'H', x: 5, y: 2 },
    { id: 'h1', type: 'H', x: 6, y: 4 },
  ],
}

export default level
