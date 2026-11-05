/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roundQueue } from './roundQueue.ts'

test('closed queue connection reopens on the next operation without stale event invalidation or retry', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
  const connections: Array<{
    onclose?: () => void
    onversionchange?: () => void
    close: () => void
    transaction: () => unknown
  }> = []
  let transactions = 0
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open() {
      let closed = false
      const db = {
        close() { closed = true },
        transaction() {
          transactions++
          if (closed) throw new Error('connection closed')
          const request = { result: [], onsuccess: undefined as (() => void) | undefined }
          const tx = {
            objectStore: () => ({ getAll: () => request }),
            oncomplete: undefined as (() => void) | undefined,
          }
          queueMicrotask(() => { request.onsuccess?.(); tx.oncomplete?.() })
          return tx
        },
      }
      connections.push(db)
      const request = { result: db, onsuccess: undefined as (() => void) | undefined }
      queueMicrotask(() => request.onsuccess?.())
      return request
    },
  } })
  try {
    assert.deepEqual(await roundQueue.list(), [])
    const first = connections[0]
    first.close()
    await assert.rejects(roundQueue.list(), /connection closed/)
    assert.equal(connections.length, 1, 'failed operation must not automatically reopen/retry')
    assert.equal(transactions, 2)
    first.onclose!()
    assert.deepEqual(await roundQueue.list(), [])
    assert.equal(connections.length, 2, 'next operation must open a fresh connection')
    first.onclose!()
    first.onversionchange!()
    await roundQueue.list()
    assert.equal(connections.length, 2, 'late events must not invalidate the new connection')
    connections[1].onversionchange!()
    await roundQueue.list()
    assert.equal(connections.length, 3, 'current versionchange must invalidate the cache')
  } finally {
    connections.at(-1)?.onclose?.()
    if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor)
    else Reflect.deleteProperty(globalThis, 'indexedDB')
  }
})
