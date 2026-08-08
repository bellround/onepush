import type { LevelDef } from './types.ts'

// 레벨은 챕터별 폴더(ch1/, ch2/, ...)에 파일만 추가하면 자동으로 로드된다 (경로 정렬 순서 = 레벨 순서).
// 챕터/번호가 두 자리 이상으로 늘어나면 폴더명·파일명도 0패딩(ch01 등)해서 정렬이 안 어긋나게 할 것.
const modules = import.meta.glob('./chapter/ch*/*.ts', { eager: true }) as Record<string, { default: LevelDef }>
export const LEVELS: LevelDef[] = Object.keys(modules)
  .sort()
  .map((path) => modules[path].default)

export { loadLevel } from './loadLevel.ts'
export type { LevelDef, LevelAtomDef } from './types.ts'
