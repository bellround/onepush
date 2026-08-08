import type { LevelDef } from '../../types.ts'

// 챕터1 마무리 — 더 긴 벽을 돌아가서 산소의 두 손을 모두 채운다.
const level: LevelDef = {
  id: 'ch1-5',
  name: '마지막 우회로',
  targetMolecule: '메탄올(CH3OH)',
  grid: {
    width: 9,
    height: 7,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],[7, 0], [8, 0],
      [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], 
      [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
      [8, 1], [8, 2], [8, 3], [8, 4], [8, 5]
    ],
  },
  atoms: [
    { id: 'o1', type: 'O', x: 2, y: 3, controlled: true },
    { id: 'h1', type: 'H', x: 5, y: 4 },
    { id: 'h2', type: 'H', x: 3, y: 4 },
    { id: 'c1', type: 'C', x: 6, y: 3 },
    { id: 'h3', type: 'H', x: 5, y: 2 },
    { id: 'h4', type: 'H', x: 3, y: 2 },
  ],
}

export default level
