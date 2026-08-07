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

// e.code(물리 키 위치) 기준. e.key와 달리 한글 등 IME 입력 상태의 영향을 받지 않는다.
export const DEFAULT_KEYBINDINGS: Record<GameAction, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  select: 'Space',
  undo: 'KeyZ',
  reset: 'KeyR',
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

// e.code 값을 화면에 보여줄 짧은 이름으로 변환.
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  const arrows: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
  }
  return arrows[code] ?? code
}
