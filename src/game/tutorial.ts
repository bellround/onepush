import { keyLabel } from './keybindings.ts'
import type { GameAction } from './keybindings.ts'

// ch1-1 전용 단계 안내. 진행 상태를 따로 저장하지 않고 보드 상태에서 파생한다 —
// 되돌리기·리셋을 하면 안내도 같이 되돌아간다.
export function tutorialHint(
  moves: number,
  bondCount: number,
  bindings: Record<GameAction, string>,
): string {
  if (bondCount > 0) {
    return `결합한 원자는 함께 움직입니다. 남은 수소도 붙여 완성하세요 (되돌리기 ${keyLabel(bindings.undo)} · 리셋 ${keyLabel(bindings.reset)})`
  }
  if (moves > 0) {
    return '산소(O) 옆에 붙이면 저절로 결합됩니다'
  }
  const arrows = (['up', 'down', 'left', 'right'] as const)
    .map((d) => keyLabel(bindings[d]))
    .join(' ')
  return `이동 키(${arrows})로 테두리가 돌고 있는 원자를 움직여 보세요`
}
