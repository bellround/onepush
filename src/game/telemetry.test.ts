/// <reference types="node" />
import { beforeEach, afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { checkpointRound, confirmRoundAccount, finishRound, flushRounds, recordAction, recordClear, sendRound, setRoundQueueForTests, startRound, suspendRoundAccount } from './telemetry.ts'
import type { PendingRound, RoundQueue } from './roundQueue.ts'

const originalFetch = globalThis.fetch
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
let entries: Map<string, string>
let queue: RoundQueue
const tick = () => new Promise(resolve => setImmediate(resolve))
beforeEach(() => {
  entries = new Map()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    get length() { return entries.size },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value) },
    removeItem: (key: string) => { entries.delete(key) },
  } })
  const get = (id: string): PendingRound | undefined => { const raw = entries.get(id); return raw ? JSON.parse(raw) : undefined }
  queue = {
    async migrate() {},
    async putNewer(entry) {
      const previous = get(entry.record.roundId)
      if (previous && previous.record.revision >= entry.record.revision) return null
      const next = { ...entry, blocked: previous?.blocked ?? entry.blocked }
      entries.set(entry.record.roundId, JSON.stringify(next))
      return structuredClone(next)
    },
    async list() { return [...entries.values()].map(raw => JSON.parse(raw)) },
    async removeIfRevision(id, revision) {
      if (get(id)?.record.revision !== revision) return false
      entries.delete(id)
      return true
    },
    async blockIfRevision(id, revision, blocked, valid = () => true) {
      const entry = get(id)
      if (entry?.record.revision === revision && valid()) entries.set(id, JSON.stringify({ ...entry, blocked }))
    },
    async unblockAccount(username, valid) {
      for (const [id] of entries) {
        const entry = get(id)!
        if (valid() && entry.blocked === 'account' && (entry.record.owner.kind === 'guest' || entry.record.owner.expectedUsername === username)) {
          delete entry.blocked
          entries.set(id, JSON.stringify(entry))
        }
      }
    },
  }
  setRoundQueueForTests(queue)
  suspendRoundAccount()
})
afterEach(() => {
  globalThis.fetch = originalFetch
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
  else Reflect.deleteProperty(globalThis, 'localStorage')
})

test('telemetry sends captured identity and releases caller on timeout or failure', async () => {
  const originalFetch = globalThis.fetch
  const originalTimeout = AbortSignal.timeout
  let requestedTimeout = 0
  AbortSignal.timeout = (milliseconds: number) => {
    requestedTimeout = milliseconds
    return originalTimeout(10)
  }
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    globalThis.fetch = (async (_url, init) => {
      assert.equal(JSON.parse(init!.body as string).expectedUsername, 'capturedplayer')
      assert.equal(init!.credentials, 'same-origin')
      await new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('timeout')), { once: true }))
      return new Response(null, { status: 204 })
    }) as typeof fetch
    confirmRoundAccount('capturedplayer')
    const run = startRound('ch1-1', 0, Date.now(), { kind: 'member', expectedUsername: 'capturedplayer' })
    await sendRound(finishRound(run, false))
    assert.equal(requestedTimeout, 5000)
    globalThis.fetch = async () => { throw new Error('offline') }
    await sendRound(finishRound(run, false))
    assert.equal(entries.size, 1)
  } finally {
    clearTimeout(keepAlive)
    globalThis.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  }
})

test('guest clear is committed before fetch and later exit has an independent revision', async () => {
  const run = startRound('ch1-1', 0, 0)
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(init!.body as string)
    assert.deepEqual(payload.owner, { kind: 'guest' })
    assert.equal(payload.expectedUsername, undefined)
    assert.equal(init!.keepalive, undefined)
    assert.equal(entries.size, 1)
    return new Response(null, { status: 503 })
  }
  recordAction(run, 'move', 'up', null, 10)
  recordClear(run, 10)
  const clear = finishRound(run, false, 10)
  const sending = sendRound(clear)
  await tick()
  assert.equal(entries.size, 1)
  recordAction(run, 'undo', null, null, 20)
  const exit = finishRound(run, true, 30)
  assert.equal(clear.actions.length, 1)
  assert.equal(exit.roundId, clear.roundId)
  assert.equal(exit.revision, clear.revision + 1)
  assert.match(exit.roundId, /^[0-9a-f-]{36}$/)
  await sending
  await sendRound(exit)
  assert.equal(JSON.parse([...entries.values()][0]).record.advancedAfterClear, true)
})

test('pagehide uses keepalive only for small snapshots and retains large ones', async () => {
  let calls = 0
  globalThis.fetch = async (_url, init) => {
    calls++
    assert.equal(init!.keepalive, true)
    return new Response(null, { status: 204 })
  }
  const run = startRound('ch1-1', 0)
  assert.equal(await sendRound(finishRound(run, false), true), 'sent')
  for (let i = 0; i < 2000; i++) recordAction(run, 'move', 'up', null)
  assert.equal(await sendRound(finishRound(run, false), true), 'queued')
  assert.equal(calls, 1)
  assert.equal(entries.size, 1)
})

test('a stale ACK never deletes a newer revision', async () => {
  let resolve!: (response: Response) => void
  globalThis.fetch = () => new Promise<Response>(done => { resolve = done })
  const run = startRound('ch1-1', 0)
  const first = sendRound(checkpointRound(run))
  await tick()
  globalThis.fetch = async () => new Response(null, { status: 503 })
  await sendRound(checkpointRound(run))
  resolve(new Response(null, { status: 204 }))
  await first
  assert.equal(JSON.parse([...entries.values()][0]).record.revision, 2)
})

test('reload flush retains guest ownership and sends only the confirmed member', async () => {
  globalThis.fetch = async () => { throw new Error('offline') }
  await sendRound(finishRound(startRound('ch1-1', 0), false))
  const member = startRound('ch1-1', 0, 0, { kind: 'member', expectedUsername: 'alice' })
  await sendRound(finishRound(member, false))
  const owners: string[] = []
  globalThis.fetch = async (_url, init) => {
    owners.push(JSON.parse(init!.body as string).owner.kind)
    return new Response(null, { status: 204 })
  }
  confirmRoundAccount('bob')
  await flushRounds()
  assert.deepEqual(owners, ['guest'])
  assert.equal(entries.size, 1)
  confirmRoundAccount('alice')
  await flushRounds()
  assert.deepEqual(owners, ['guest', 'member'])
  assert.equal(entries.size, 0)
})

test('401/409 wait for original account confirmation; invalid payloads never loop', async () => {
  for (const status of [401, 409, 400, 413]) {
    entries.clear()
    confirmRoundAccount('alice')
    let calls = 0
    globalThis.fetch = async () => { calls++; return new Response(null, { status }) }
    const run = startRound('ch1-1', 0, 0, { kind: 'member', expectedUsername: 'alice' })
    await sendRound(finishRound(run, false))
    await flushRounds()
    await sendRound(finishRound(run, false))
    assert.equal(calls, 1)
    confirmRoundAccount('bob')
    await flushRounds()
    assert.equal(calls, 1)
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 204 }) }
    confirmRoundAccount('alice')
    await flushRounds()
    assert.equal(calls, status === 401 || status === 409 ? 2 : 1)
  }
})

test('network, 5xx and 429 remain durable and flush retries after reload', async () => {
  for (const status of [0, 500, 429]) {
    globalThis.fetch = async () => {
      if (!status) throw new Error('offline')
      return new Response(null, { status })
    }
    await sendRound(finishRound(startRound('ch1-1', 0), false))
    assert.equal(entries.size, 1)
    globalThis.fetch = async () => new Response(null, { status: 204 })
    await flushRounds()
    assert.equal(entries.size, 0)
  }
})

test('storage failure is reported, not silently treated as successful delivery', async () => {
  const originalError = console.error
  let errors = 0
  console.error = () => { errors++ }
  queue.putNewer = async () => { throw new Error('quota') }
  globalThis.fetch = async () => { assert.fail('must persist before fetching') }
  try {
    assert.equal(await sendRound(finishRound(startRound('ch1-1', 0), false)), 'storage-error')
    assert.equal(await sendRound(checkpointRound(startRound('ch1-1', 0))), 'storage-error')
    assert.equal(errors, 2)
  } finally { console.error = originalError }
})

test('checkpoint persists before unresolved fetch and recovers unchanged for its original account', async () => {
  confirmRoundAccount('alice')
  const run = startRound('ch1-1', 0, 100, { kind: 'member', expectedUsername: 'alice' })
  recordAction(run, 'move', 'up', null, 150)
  let reject!: (error: Error) => void
  globalThis.fetch = () => new Promise((_resolve, fail) => { reject = fail })
  const sending = sendRound(checkpointRound(run))
  await tick()
  const saved = JSON.parse([...entries.values()][0]).record
  assert.equal(saved.quitMs, null)
  assert.equal(saved.actions.length, 1)
  assert.equal(saved.revision, 1)
  assert.equal(saved.sessionId, run.sessionId)
  reject(new Error('offline'))
  assert.equal(await sending, 'queued')
  suspendRoundAccount()
  const payloads: unknown[] = []
  globalThis.fetch = async (_url, init) => {
    payloads.push(JSON.parse(init!.body as string))
    return new Response(null, { status: 204 })
  }
  confirmRoundAccount('bob')
  await flushRounds()
  assert.equal(payloads.length, 0)
  confirmRoundAccount('alice')
  await flushRounds()
  assert.deepEqual(payloads, [{ ...saved, expectedUsername: 'alice' }])
  assert.equal(entries.size, 0)
})

test('checkpoint revisions preserve the first clear through undo, reset and exit', () => {
  const run = startRound('ch1-1', 0, 0)
  const initial = checkpointRound(run)
  assert.equal(initial.quitMs, null)
  assert.equal(initial.cleared, false)
  recordAction(run, 'move', 'up', null, 10)
  recordClear(run, 10)
  const clear = checkpointRound(run)
  recordAction(run, 'undo', null, null, 20)
  const undo = checkpointRound(run)
  recordAction(run, 'reset', null, null, 30)
  const reset = checkpointRound(run)
  const exit = finishRound(run, false, 40)
  for (const [index, record] of [initial, clear, undo, reset, exit].entries()) {
    assert.equal(record.revision, index + 1)
    assert.equal(record.roundId, initial.roundId)
    assert.equal(record.sessionId, initial.sessionId)
    if (index > 0) {
      assert.equal(record.cleared, true)
      assert.equal(record.clearMs, 10)
      assert.equal(record.quitMs, null)
    }
  }
  assert.equal(clear.actions.length, 1)
  assert.equal(reset.resetCount, 1)
  assert.equal(exit.undoCount, 1)
})

test('fetch waits for durable commit; rejected commit never fetches, including pagehide', async () => {
  const put = queue.putNewer.bind(queue)
  let complete!: () => void
  let calls = 0
  queue.putNewer = entry => new Promise(resolve => { complete = () => { void put(entry).then(resolve) } })
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 204 }) }
  const record = checkpointRound(startRound('ch1-1', 0))
  const sending = sendRound(record, true)
  record.actions.push({ kind: 'reset', direction: null, t: 1, board: null })
  await tick()
  assert.equal(calls, 0)
  complete()
  assert.equal(await sending, 'sent')
  assert.equal(calls, 1)
  const originalError = console.error
  console.error = () => {}
  try {
    queue.putNewer = async () => { throw new Error('strict transaction aborted') }
    assert.equal(await sendRound(record, true), 'storage-error')
    assert.equal(calls, 1)
  } finally { console.error = originalError }
})

test('클리어한 라운드 — 첫 수 시각, 최대 간격, 횟수 집계', () => {
  const run = startRound('ch1-4', 3, 1000)
  recordAction(run, 'move', 'up', null, 1500) // 첫 수: 500ms
  recordAction(run, 'move', 'left', null, 1700) // 간격 200ms
  recordAction(run, 'undo', null, null, 1800)
  recordAction(run, 'reset', null, null, 1900)
  recordAction(run, 'move', 'right', null, 3000) // 간격 1300ms ← 최대
  recordClear(run, 3100)

  const record = finishRound(run, true, 4000)

  assert.equal(record.cleared, true)
  assert.equal(record.clearMs, 2100)
  assert.equal(record.quitMs, null)
  assert.equal(record.advancedAfterClear, true)
  assert.equal(record.firstMoveMs, 500)
  assert.equal(record.maxGapMs, 1300)
  assert.equal(record.resetCount, 1)
  assert.equal(record.undoCount, 1)
  assert.equal(record.actions.length, 5)
})

test('클리어 판정이 여러 번 들어와도 첫 시각만 남는다', () => {
  const run = startRound('ch1-1', 0, 0)
  recordClear(run, 500)
  recordClear(run, 900)
  assert.equal(run.clearMs, 500)
})

test('포기한 라운드 — 종료 시점이 기록되고 클리어 시간은 null', () => {
  const run = startRound('ch2-3', 7, 0)
  const record = finishRound(run, false, 2500)

  assert.equal(record.cleared, false)
  assert.equal(record.clearMs, null)
  assert.equal(record.quitMs, 2500)
  assert.equal(record.firstMoveMs, null)
  assert.equal(record.maxGapMs, null) // 수가 1개 이하면 간격 없음
})
