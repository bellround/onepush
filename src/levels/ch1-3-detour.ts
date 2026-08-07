import type { LevelDef } from './types.ts'

// 벽 하나를 돌아가야 산소에 닿는 레벨. 원자가 개념 + 밀기 방향 전환 연습.
const level: LevelDef = {
  id: 'ch1-3',
  name: '돌아가기',
  targetMolecule: 'H2O',
  grid: {
    width: 6,
    height: 3,
    walls: [[1, 1]],
  },
  atoms: [
    { id: 'h1', type: 'H', x: 0, y: 1, controlled: true },
    { id: 'o1', type: 'O', x: 3, y: 1 },
    { id: 'h2', type: 'H', x: 5, y: 1 },
  ],
}

export default level
