import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AccountError, enterAccount, getAccount, logoutAccount, resetAccountProgress, saveAccountProgress } from './account.ts'

test('account client contract, credentials, errors and no local progress import', async () => {
  const original = globalThis.fetch
  const calls: { url: string; init?: RequestInit }[] = []
  let status = 200
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(status === 204 ? null : JSON.stringify({ username: 'player', progress: 2 }), { status })
  }) as typeof fetch
  try {
    assert.deepEqual(await enterAccount('player', 'password'), { username: 'player', progress: 2, keybindings: null })
    assert.deepEqual(JSON.parse(calls[0].init!.body as string), { username: 'player', password: 'password' })
    assert.equal(calls[0].init!.credentials, 'same-origin')
    await saveAccountProgress('ch1-2', 'player')
    assert.deepEqual(JSON.parse(calls[1].init!.body as string), { levelId: 'ch1-2', expectedUsername: 'player' })
    status = 401
    assert.equal(await getAccount(), null)
    await assert.rejects(enterAccount('player', 'wrong'), /로그인/)
    await assert.rejects(saveAccountProgress('ch1-2', 'player'), error => error instanceof AccountError && error.status === 401)
    status = 409
    await assert.rejects(saveAccountProgress('ch1-2', 'player'), error => error instanceof AccountError && error.status === 409)
    status = 503
    await assert.rejects(getAccount(), /서버/)
    status = 204
    await logoutAccount()
    assert.match(calls.at(-1)!.url, /\/account\/logout$/)
  } finally { globalThis.fetch = original }
})

test('guest progress merge, progress reset and server-provided messages', async () => {
  const original = globalThis.fetch
  const calls: { url: string; init?: RequestInit }[] = []
  let status = 200
  let body: unknown = { username: 'Kim', progress: 7 }
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  try {
    // 승계할 게스트 진행도가 없으면 보내지 않는다.
    await enterAccount('kim', 'password')
    assert.deepEqual(JSON.parse(calls[0].init!.body as string), { username: 'kim', password: 'password' })
    // 서버가 돌려주는 원본 표기를 그대로 쓴다.
    assert.deepEqual(await enterAccount('KIM', 'password', 5), { username: 'Kim', progress: 7, keybindings: null })
    assert.deepEqual(JSON.parse(calls[1].init!.body as string), { username: 'KIM', password: 'password', guestProgress: 5 })
    body = { username: 'Kim', progress: 0 }
    assert.deepEqual(await resetAccountProgress('password'), { username: 'Kim', progress: 0, keybindings: null })
    assert.match(calls.at(-1)!.url, /\/account\/reset$/)
    assert.deepEqual(JSON.parse(calls.at(-1)!.init!.body as string), { password: 'password' })
    // 서버가 보낸 안내가 고정 문구보다 우선한다.
    status = 400
    body = { error: '비밀번호는 4자 이상이어야 합니다.' }
    await assert.rejects(enterAccount('kim', 'abc'), /4자 이상이어야 합니다/)
    body = {}
    await assert.rejects(enterAccount('kim', 'abc'), error => error instanceof AccountError && error.status === 400 && /문자와 숫자만/.test(error.message))
    status = 401
    body = { error: '비밀번호가 올바르지 않습니다.' }
    await assert.rejects(resetAccountProgress('wrong'), /비밀번호가 올바르지/)
  } finally { globalThis.fetch = original }
})
