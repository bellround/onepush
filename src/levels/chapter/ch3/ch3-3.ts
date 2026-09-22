import type { LevelDef } from '../../types.ts'

const level: LevelDef = {
  id: 'ch3-3',
  name: '',
  targetMolecule: '',
  explanation: '',
  moleculeName: '',
  moleculeExplanation: '',
  grid: {
    width: 7,
    height: 8,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
      [0, 1], [6, 1],
      [0, 2], [6, 2],
      [0, 3], [6, 3],
      [0, 4], [6, 4],
      [0, 5], [6, 5],
      [0, 6], [6, 6],
      [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
      [2, 5], [4, 5],
    ],
  },

  atoms: [
    { id: 'He1', type: 'He', x: 3, y: 3, controlled: true },
    { id: 'H2', type: 'H', x: 5, y: 4 },
    { id: 'H1', type: 'H', x: 1, y: 4 },
    { id: 'H3', type: 'H', x: 3, y: 4 },
    { id: "N1", type: "N", x: 3, y: 2}
    
  ],
}

export default level
