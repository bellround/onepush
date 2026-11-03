const STORAGE_KEY = 'progress'

// 저장된 값 = 다음에 이어서 시작할 레벨 인덱스
export function loadProgress(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const index = raw === null ? 0 : Number(raw)
    return Number.isInteger(index) && index >= 0 ? index : 0
  } catch {
    return 0
  }
}

// 저장이 차단되어도(사생활 보호 모드 등) 게스트 플레이는 계속할 수 있어야 한다.
export function saveProgress(levelIndex: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(levelIndex))
  } catch {
    // 이번 세션 동안만 진행도가 유지된다.
  }
}

export function resetProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 지울 저장소가 없으면 지울 것도 없다.
  }
}

// 레벨을 깼을 때 저장할 진행도 — 이미 깬 레벨을 다시 깨도 줄지 않는다.
export function advanceProgress(levelIndex: number): number {
  const next = Math.max(loadProgress(), levelIndex + 1)
  saveProgress(next)
  return next
}
