import type { LevelDef } from '../../types.ts'

// 기획서 5.2 "첫 만남" — 원자가 1인 원자끼리는 정확히 1:1로만 결합됨을 체험
const level: LevelDef = {
  id: 'ch1-1',
  name: '제일 쉬운거',
  targetMolecule: '물(H2O)',
  explanation: '',
  moleculeName: 'H2O',
  moleculeExplanation: 'ㅇㅁ러모ㅓ오ㅓㄹ머아뉼마ㅓㅇ뉼ㅇ머ㅜ ㅁ윤륨ㄹㅁ유ㅣㅇ로ㅓㅁ',
  grid: { 
    width: 7,
    height: 6,
    walls: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [4, 5],
      [5, 5], 
      [6, 5],
      [4, 3],
      [4, 2],
    ],
   },
  
  atoms: [
    { id: 'h1', type: 'H', x: 1, y: 4, controlled: true },
    { id: 'o1', type: 'O', x: 3, y: 3 },
    { id: 'h2', type: 'H', x: 5, y: 2 },
  ],
}

export default level
