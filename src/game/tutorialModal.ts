import { keyLabel, type GameAction } from './keybindings.ts'

export const TUTORIAL_COMPLETED_KEY = 'element-puzzle-contextual-tutorial-v2-completed'

export function shouldStartTutorial(levelId: string): boolean {
  return levelId === 'ch1-1' && !hasCompletedTutorial()
}

export function hasCompletedTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true'
  } catch {
    return false
  }
}

export function completeTutorial(): void {
  try {
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true')
  } catch {
    // 저장이 차단되어도 안내를 닫고 게임을 계속할 수 있다.
  }
}

export function tutorialSteps(bindings: Record<GameAction, string>) {
  return [
    {
      title: '점선 원자를 움직여요',
      target: 'player',
      paragraphs: [
        '보드에서 점선 테두리가 있는 원자 타일이 내가 조종하는 원자예요. 다른 원자를 클릭해서 바꾸는 방식은 아니에요.',
        '원소 기호 아래의 숫자는 앞으로 만들 수 있는 결합 수예요. 결합하면 숫자가 줄어들어요.',
      ],
    },
    {
      title: '방향 키로 한 칸씩 이동해요',
      target: 'player',
      paragraphs: [
        `위 ${keyLabel(bindings.up)} / 아래 ${keyLabel(bindings.down)} / 왼쪽 ${keyLabel(bindings.left)} / 오른쪽 ${keyLabel(bindings.right)} 키로 움직여요. 키보드로 조작하며, 설정에서 키를 바꿀 수 있어요.`,
        '결합된 원자들은 함께 움직여요. 다른 원자도 밀 수 있지만, 밀려는 원자까지 포함해 벽이나 보드 끝에 막히면 이동할 수 없어요.',
        '이동할 방향에 결합 가능한 원자가 바로 붙어 있으면, 그 자리에서 이동 대신 결합해요.',
      ],
    },
    {
      title: '원자를 연결하면 클리어!',
      target: 'goal',
      paragraphs: [
        '이동 후 원자들이 위·아래·왼쪽·오른쪽으로 붙고, 양쪽 모두 남은 결합 수가 있으면 자동으로 결합해요.',
        '결합 가능한 원자를 모두 하나로 연결하고, 그 원자들의 숫자를 모두 0으로 만들면 클리어예요. 처음부터 결합할 수 없는 He(헬륨)는 연결하지 않아도 돼요.',
        '나중에 + 표시가 나오면, 이미 생긴 결합선이 그 표시를 가로질러 지나가게 해 보세요. 양쪽에 남은 결합 수가 있으면 결합선이 하나 더 생겨요.',
      ],
    },
    {
      title: '실수해도 다시 해 볼 수 있어요',
      target: 'recovery',
      paragraphs: [
        `되돌리기 (${keyLabel(bindings.undo)}) 키: 바로 전 이동이나 결합을 취소해요. 여러 번 누르면 차례로 되돌아가요.`,
        `리셋 (${keyLabel(bindings.reset)}) 키: 지금 레벨을 처음 상태로 되돌려요. 리셋하면 되돌리기 기록도 지워져요.`,
        '안내를 닫은 뒤에 게임 키가 작동해요.',
      ],
    },
  ]
}
