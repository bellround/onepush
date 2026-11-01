import type { LevelDef } from '../../types.ts'

const level: LevelDef = {
  id: 'ch1-4',
  name: '손이 세 개',
  targetMolecule: '하이드록실아민(NH₂OH)',
  explanation: '하이드록실아민은 나일론 원료를 만드는 데 쓰인다',
  moleculeName: '하이드록실아민(NH₂OH)',
  moleculeExplanation: '질소 1개, 수소 3개, 산소 1개가 붙어서 생긴 분자',
  grid: {
    width: 8,
    height: 7,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],[7, 0], 
      [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], 
      [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
      [7, 1], [7, 2], [7, 3], [7, 4], [7, 5],
    ],
  },
  atoms: [
    { id: 'n1', type: 'N', x: 6, y: 3, controlled: true },
    { id: 'h1', type: 'H', x: 4, y: 4 },
    { id: 'h2', type: 'H', x: 3, y: 3 },
    { id: 'o1', type: 'O', x: 1, y: 3 },
    { id: 'h3', type: 'H', x: 4, y: 2 },
  ],
}

export default level
