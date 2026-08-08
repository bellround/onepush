import type { LevelDef } from '../../types.ts'

// 기획서 9번 표 JSON 예시("물방울") 그대로
const level: LevelDef = {
  id: 'ch1-2',
  name: '좁은방',
  targetMolecule: '물(H2O)',
  explanation: '',
  moleculeName: '물(H2O)',
  moleculeExplanation: '',
  grid: {
    width: 5,
    height: 4,
    walls: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [2, 3],
      [3, 3],
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3],
    ],
  },
  atoms: [
    { id: 'h1', type: 'H', x: 0, y: 1 },
    { id: 'h2', type: 'H', x: 0, y: 3, controlled: true },
    { id: 'o1', type: 'O', x: 3, y: 1 },
  ],
}

export default level
