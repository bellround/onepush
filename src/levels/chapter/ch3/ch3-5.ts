import type { LevelDef } from '../../types.ts'

const level: LevelDef = {
  id: 'ch3-2',
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
      [1, 6], [2, 6], [3, 6], [5, 6], [6, 6], [7, 6],
      [1, 5], [2, 5], [3, 5], [5, 5], [6, 5], [7, 5],
    ],
  },

  atoms: [
    { id: 'N1', type: 'N', x: 4, y: 3, controlled: true },
    { id: 'H2', type: 'H', x: 4, y: 6 },
    { id: 'H1', type: 'H', x: 2, y: 3 },
    { id: 'H3', type: 'H', x: 6, y: 3 },
    { id: "He1", type: "He", x: 3, y: 3},
    { id: "He2", type: "He", x: 3, y: 2},
    { id: "He3", type: "He", x: 3, y: 4},
    { id: "He4", type: "He", x: 5, y: 3},
    { id: "He5", type: "He", x: 5, y: 2},
    { id: "He6", type: "He", x: 5, y: 4},
    { id: "He7", type: "He", x: 4, y: 2},
    
  ],
}

export default level
