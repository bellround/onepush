export type GameAction = 'up' | 'down' | 'left' | 'right' | 'select' | 'undo' | 'reset' | 'exit'

// keyborde.md 표기 순서/이름 그대로.
export const ACTION_LABELS: Record<GameAction, string> = {
  up: '위',
  down: '아래',
  left: '왼쪽',
  right: '오른쪽',
  select: '선택',
  undo: '되돌리기',
  reset: '리셋',
  exit: '종료',
}

export const DEFAULT_KEYBINDINGS: Record<GameAction, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  select: ' ',
  undo: 'z',
  reset: 'r',
  exit: 'Escape',
}

const STORAGE_KEY = 'keybindings'

export function loadKeybindings(): Record<GameAction, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_KEYBINDINGS }
    return { ...DEFAULT_KEYBINDINGS, ...(JSON.parse(raw) as Partial<Record<GameAction, string>>) }
  } catch {
    return { ...DEFAULT_KEYBINDINGS }
  }
}

export function saveKeybindings(bindings: Record<GameAction, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
}

export function keyLabel(key: string): string {
  return key === ' ' ? 'Space' : key
}
