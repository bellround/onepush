import ch1_1 from './ch1-1-h2.ts'
import ch1_2 from './ch1-2-water.ts'
import ch1_3 from './ch1-3-detour.ts'
import ch1_4 from './ch1-4-full-hands.ts'
import type { LevelDef } from './types.ts'

// 새 레벨은 파일 만들고 여기 배열에 추가하면 된다.
export const LEVELS: LevelDef[] = [ch1_1, ch1_2, ch1_3, ch1_4]

export { loadLevel } from './loadLevel.ts'
export type { LevelDef, LevelAtomDef } from './types.ts'
