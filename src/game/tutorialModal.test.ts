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
    assert.equal(hasCompletedTutorial('account-a'), false)
    assert.equal(shouldStartTutorial('ch1-1', 'account-a'), true)
    assert.equal(shouldStartTutorial('ch1-2', 'account-a'), false)
    assert.equal(shouldStartTutorial('ch2-1', 'account-a'), false)
    assert.equal(shouldStartTutorial('', 'account-a'), false)
    completeTutorial('account-a')
    assert.equal(hasCompletedTutorial('account-a'), true)
    assert.equal(shouldStartTutorial('ch1-1', 'account-a'), false)
    assert.equal(hasCompletedTutorial('account-b'), false)
    assert.equal(shouldStartTutorial('ch1-1', 'account-b'), true)
    assert.equal(shouldStartTutorial('ch1-2', 'account-b'), false)
    completeTutorial('account-b')
    assert.equal(hasCompletedTutorial('account-b'), true)
    assert.equal(hasCompletedTutorial('account-a'), true)
    assert.equal(values.get(`${TUTORIAL_COMPLETED_KEY}:account-a`), 'true')
    assert.equal(values.get(`${TUTORIAL_COMPLETED_KEY}:account-b`), 'true')
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
    assert.equal(hasCompletedTutorial('account-a'), false)
    assert.equal(shouldStartTutorial('ch1-1', 'account-a'), true)
    assert.equal(shouldStartTutorial('ch1-2', 'account-a'), false)
    assert.doesNotThrow(() => completeTutorial('account-a'))
    assert.equal(hasCompletedTutorial('account-a'), false)
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
