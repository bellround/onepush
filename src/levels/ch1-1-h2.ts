import type { LevelDef } from './types.ts'

// 기획서 5.2 "첫 만남" — 원자가 1인 원자끼리는 정확히 1:1로만 결합됨을 체험
const level: LevelDef = {
  id: 'ch1-1',
  name: '첫 만남',
  targetMolecule: 'H2',
  grid: { width: 3, height: 3 },
  atoms: [
    { id: 'h1', type: 'H', x: 0, y: 1, controlled: true },
    { id: 'h2', type: 'H', x: 2, y: 1 },
  ],
}

export default level
