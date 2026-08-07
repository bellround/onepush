import type { LevelDef } from './types.ts'

// 새 레벨은 파일만 만들면 자동으로 로드된다 (파일명 정렬 순서 = 레벨 순서).
// 챕터/번호가 두 자리 이상으로 늘어나면 파일명도 0패딩(ch1-01 등)해서 정렬이 안 어긋나게 할 것.
const modules = import.meta.glob('./ch*.ts', { eager: true }) as Record<string, { default: LevelDef }>
export const LEVELS: LevelDef[] = Object.keys(modules)
  .sort()
  .map((path) => modules[path].default)

export { loadLevel } from './loadLevel.ts'
export type { LevelDef, LevelAtomDef } from './types.ts'
