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

export function saveProgress(levelIndex: number): void {
  localStorage.setItem(STORAGE_KEY, String(levelIndex))
}

export function resetProgress(): void {
  localStorage.removeItem(STORAGE_KEY)
}
