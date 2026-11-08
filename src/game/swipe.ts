import type { Direction } from './types.ts'

// 이보다 짧게 끊긴 터치는 탭으로 본다(px).
export const SWIPE_MIN = 24

// 우세 축 하나만 골라 방향을 낸다 — 대각선으로 그어도 한 방향 1칸만 움직인다.
export function swipeDirection(dx: number, dy: number): Direction | null {
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (Math.abs(dx) < SWIPE_MIN) return null
    return dx > 0 ? 'right' : 'left'
  }
  if (Math.abs(dy) < SWIPE_MIN) return null
  return dy > 0 ? 'down' : 'up'
}
