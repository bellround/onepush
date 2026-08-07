import type { LevelDef } from './types.ts'

// 챕터1 마무리 — 더 긴 벽을 돌아가서 산소의 두 손을 모두 채운다.
const level: LevelDef = {
  id: 'ch1-4',
  name: '손을 다 채우기',
  targetMolecule: 'H2O',
  grid: {
    width: 7,
    height: 3,
    walls: [
      [1, 1],
      [2, 1],
    ],
  },
  atoms: [
    { id: 'h1', type: 'H', x: 0, y: 1, controlled: true },
    { id: 'o1', type: 'O', x: 4, y: 1 },
    { id: 'h2', type: 'H', x: 6, y: 1 },
  ],
}

export default level
