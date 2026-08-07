import type { LevelDef } from './types.ts'

// 기획서 9번 표 JSON 예시("물방울") 그대로
const level: LevelDef = {
  id: 'ch1-2',
  name: '물방울',
  targetMolecule: 'H2O',
  grid: {
    width: 5,
    height: 5,
    walls: [
      [0, 0],
      [0, 1],
      [4, 0],
      [4, 1],
    ],
  },
  atoms: [
    { id: 'o1', type: 'O', x: 2, y: 2 },
    { id: 'h1', type: 'H', x: 1, y: 2, controlled: true },
    { id: 'h2', type: 'H', x: 4, y: 2 },
  ],
}

export default level
