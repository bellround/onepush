import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AccountError, enterAccount, getAccount, logoutAccount, saveAccountProgress } from './account.ts'

test('account client contract, credentials, errors and no local progress import', async () => {
  const original = globalThis.fetch
  const calls: { url: string; init?: RequestInit }[] = []
  let status = 200
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(status === 204 ? null : JSON.stringify({ username: 'player', progress: 2 }), { status })
  }) as typeof fetch
  try {
    assert.deepEqual(await enterAccount('player', 'password'), { username: 'player', progress: 2 })
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
