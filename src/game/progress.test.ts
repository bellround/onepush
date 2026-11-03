import assert from 'node:assert/strict'
import { test } from 'node:test'
import { advanceProgress, loadProgress, resetProgress, saveProgress } from './progress.ts'

test('guest progress keeps the furthest cleared level', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
  try {
    assert.equal(loadProgress(), 0)
    assert.equal(advanceProgress(0), 1)
    assert.equal(advanceProgress(1), 2)
    assert.equal(loadProgress(), 2)
    // 이미 깬 레벨을 다시 깨도 진행도는 줄지 않는다.
    assert.equal(advanceProgress(0), 2)
    assert.equal(loadProgress(), 2)
    saveProgress(5)
    assert.equal(loadProgress(), 5)
    resetProgress()
    assert.equal(loadProgress(), 0)
    values.set('progress', '-3')
    assert.equal(loadProgress(), 0)
    values.set('progress', 'nope')
    assert.equal(loadProgress(), 0)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('blocked storage does not break guest play', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => { throw new Error('Storage blocked') },
  })
  try {
    assert.equal(loadProgress(), 0)
    assert.doesNotThrow(() => saveProgress(2))
    assert.doesNotThrow(() => resetProgress())
    assert.equal(advanceProgress(3), 4)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
