import type { LevelDef } from '../../types.ts'

const level: LevelDef = {
  id: 'ch3-2',
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
  },

  atoms: [
    { id: 'He1', type: 'He', x: 4, y: 5, controlled: true },
    { id: 'H2', type: 'H', x: 5, y: 4 },
    { id: 'H1', type: 'H', x: 2, y: 4 },
    { id: 'H3', type: 'H', x: 4, y: 2 },
    { id: "N1", type: "N", x: 3, y: 3}
    
  ],
}

export default level
