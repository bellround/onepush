import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_KEYBINDINGS } from './keybindings.ts'
import { completeTutorial, hasCompletedTutorial, shouldStartTutorial, TUTORIAL_COMPLETED_KEY, tutorialStepDelta, tutorialSteps } from './tutorialModal.ts'

test('tutorial completion persists per account without inheriting legacy completion or game progress', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>([['progress', '3'], ['element-puzzle-tutorial-v1-completed', 'true'], [TUTORIAL_COMPLETED_KEY, 'true']])
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
  try {
    assert.equal(hasCompletedTutorial('player1'), false)
    assert.equal(shouldStartTutorial('ch1-1', 'player1'), true)
    assert.equal(shouldStartTutorial('ch1-2', 'player1'), false)
    assert.equal(shouldStartTutorial('ch2-1', 'player1'), false)
    assert.equal(shouldStartTutorial('', 'player1'), false)
    completeTutorial('player1')
    assert.equal(hasCompletedTutorial('player1'), true)
    assert.equal(shouldStartTutorial('ch1-1', 'player1'), false)
    assert.equal(hasCompletedTutorial('player2'), false)
    assert.equal(shouldStartTutorial('ch1-1', 'player2'), true)
    assert.equal(shouldStartTutorial('ch1-2', 'player2'), false)
    completeTutorial('player2')
    assert.equal(hasCompletedTutorial('player2'), true)
    assert.equal(hasCompletedTutorial('player1'), true)
    assert.equal(values.get(`${TUTORIAL_COMPLETED_KEY}:player1`), 'true')
    assert.equal(values.get(`${TUTORIAL_COMPLETED_KEY}:player2`), 'true')
    assert.equal(values.get(TUTORIAL_COMPLETED_KEY), 'true')
    assert.equal(values.get('progress'), '3')
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('blocked storage does not prevent opening or completing the tutorial', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => { throw new Error('Storage blocked') },
  })
  try {
    assert.equal(hasCompletedTutorial('player1'), false)
    assert.equal(shouldStartTutorial('ch1-1', 'player1'), true)
    assert.equal(shouldStartTutorial('ch1-2', 'player1'), false)
    assert.doesNotThrow(() => completeTutorial('player1'))
    assert.equal(hasCompletedTutorial('player1'), false)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('step keys map physical keys to next and previous', () => {
  for (const code of ['Enter', 'NumpadEnter', 'Space', 'ArrowRight', 'KeyD']) assert.equal(tutorialStepDelta(code), 1)
  for (const code of ['ArrowLeft', 'KeyA']) assert.equal(tutorialStepDelta(code), -1)
  for (const code of ['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Escape', 'Tab']) assert.equal(tutorialStepDelta(code), 0)
})

test('basic steps reflect custom movement and recovery keys', () => {
  const steps = tutorialSteps({ ...DEFAULT_KEYBINDINGS, up: 'KeyW', undo: 'KeyU', reset: 'KeyT' })
  assert.equal(steps.length, 4)
  assert.deepEqual(steps.map((step) => step.target), ['player', 'player', 'goal', 'recovery'])
  assert.match(steps[1].paragraphs[0], /위 W/)
  assert.match(steps[3].paragraphs[0], /되돌리기 \(U\)/)
  assert.match(steps[3].paragraphs[1], /리셋 \(T\)/)
  assert.match(steps[2].paragraphs[1], /모두 하나로 연결/)
  assert.match(steps[2].paragraphs[1], /모두 0/)
  assert.match(steps[2].paragraphs[1], /He/)
})

test('모바일 안내는 키 이름 대신 드래그와 버튼을 말하고, 숨겨지지 않는 곳을 비춘다', () => {
  const steps = tutorialSteps(DEFAULT_KEYBINDINGS, true)
  const text = steps.flatMap((step) => [step.title, ...step.paragraphs]).join('\n')
  for (const key of ['↑', '↓', '←', '→', 'Z 키', 'R 키', '방향 키', '게임 키']) {
    assert.ok(!text.includes(key), `모바일 안내에 "${key}" 가 남아 있다`)
  }
  assert.ok(steps[1].title.includes('드래그'))
  assert.ok(steps[3].paragraphs[0].includes('되돌리기 버튼'))
  assert.ok(steps[3].paragraphs[1].includes('리셋 버튼'))
  // 좌상단 키 안내는 모바일에서 display:none이라 비출 수 없다.
  assert.equal(steps[3].target, 'recovery-touch')
  // 데스크톱은 그대로 키 이름을 쓴다.
  assert.equal(tutorialSteps(DEFAULT_KEYBINDINGS).at(-1)!.target, 'recovery')
  assert.ok(tutorialSteps(DEFAULT_KEYBINDINGS)[1].paragraphs[0].includes('↑'))
})
