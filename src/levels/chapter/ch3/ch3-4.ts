import type { LevelDef } from '../../types.ts'

const level: LevelDef = {
  id: 'ch3-4',
  name: '',
  targetMolecule: '',
  explanation: '',
  moleculeName: '',
  moleculeExplanation: '',
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
      [0, 6], [8, 6],
      [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7],
      [1, 3], [3, 3], [5, 3], [7, 3],
    ],
  },

  atoms: [
    { id: 'He1', type: 'He', x: 4, y: 5, controlled: true },
    { id: 'H2', type: 'H', x: 5, y: 5 },
    { id: 'H1', type: 'H', x: 3, y: 5 },
    { id: 'H3', type: 'H', x: 6, y: 3 },
    { id: 'H4', type: 'H', x: 2, y: 3 },
    { id: "C1", type: "C", x: 4, y: 3}
    
  ],
}

export default level
