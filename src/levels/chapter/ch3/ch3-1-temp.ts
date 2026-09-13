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
    // { id: 'x1', type: 'H', x: 0, y: 0, controlled: true },
  ],
}

export default level
