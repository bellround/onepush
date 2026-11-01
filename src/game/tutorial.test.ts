/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_KEYBINDINGS } from './keybindings.ts'
import { tutorialHint } from './tutorial.ts'

test('아직 안 움직였으면 이동 키를 알려준다', () => {
  const hint = tutorialHint(0, 0, DEFAULT_KEYBINDINGS)

  assert.match(hint, /↑ ↓ ← →/)
})

test('움직였고 아직 결합이 없으면 붙이라고 알려준다', () => {
  const hint = tutorialHint(1, 0, DEFAULT_KEYBINDINGS)

  assert.match(hint, /결합됩니다/)
})

test('결합이 생기면 함께 움직인다는 것과 되돌리기 키를 알려준다', () => {
  const hint = tutorialHint(3, 1, DEFAULT_KEYBINDINGS)

  assert.match(hint, /함께 움직입니다/)
  assert.match(hint, /되돌리기 Z/)
})

test('키를 바꾸면 안내 문구도 바뀐 키를 쓴다', () => {
  const hint = tutorialHint(3, 1, { ...DEFAULT_KEYBINDINGS, undo: 'KeyQ' })

  assert.match(hint, /되돌리기 Q/)
})
