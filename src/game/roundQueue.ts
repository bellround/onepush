import type { RoundRecord } from './telemetry.ts'

export interface PendingRound {
  record: RoundRecord & { sessionId: string }
  blocked?: 'account' | 'invalid'
}

export interface RoundQueue {
  putNewer(entry: PendingRound): Promise<PendingRound | null>
  list(): Promise<PendingRound[]>
  removeIfRevision(id: string, revision: number): Promise<boolean>
  blockIfRevision(id: string, revision: number, blocked: 'account' | 'invalid', valid?: () => boolean): Promise<void>
  unblockAccount(username: string | null, valid: () => boolean): Promise<void>
  migrate(): Promise<void>
}

const PREFIX = 'round-queue:v1:'
let opening: Promise<IDBDatabase> | undefined
function open(): Promise<IDBDatabase> {
  if (opening) return opening
  const connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ion-round-queue', 1)
    let rejected = false
    request.onupgradeneeded = () => {
      request.result.createObjectStore('pending', { keyPath: 'record.roundId' })
      request.result.createObjectStore('legacyImports')
    }
    request.onblocked = () => { rejected = true; reject(new Error('Round queue upgrade blocked')) }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      if (rejected) { db.close(); return }
      const invalidate = () => { if (opening === connection) opening = undefined }
      db.onclose = invalidate
      db.onversionchange = () => { db.close(); invalidate() }
      resolve(db)
    }
  }).catch(error => { if (opening === connection) opening = undefined; throw error })
  opening = connection
  return connection
}

async function transaction<T>(stores: string[], mutate: boolean, work: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mutate ? 'readwrite' : 'readonly', mutate ? { durability: 'strict' } : undefined)
    let value: T
    tx.oncomplete = () => resolve(value)
    tx.onabort = () => reject(tx.error ?? new Error('Round queue transaction aborted'))
    tx.onerror = () => { /* onabort reports transaction failure. */ }
    if (mutate && tx.durability !== 'strict') {
      tx.abort()
      reject(new Error('Strict IndexedDB durability unavailable'))
      return
    }
    try { work(tx, next => { value = next }) }
    catch (error) { tx.abort(); reject(error) }
  })
}

function update(id: string, revision: number, change: (entry: PendingRound, store: IDBObjectStore) => void): Promise<boolean> {
  return transaction(['pending'], true, (tx, result) => {
    const store = tx.objectStore('pending')
    const request = store.get(id)
    request.onsuccess = () => {
      const entry = request.result as PendingRound | undefined
      const matches = entry?.record.revision === revision
      if (matches) change(entry, store)
      result(matches)
    }
  })
}

export const roundQueue: RoundQueue = {
  putNewer(entry) {
    return transaction(['pending'], true, (tx, result) => {
      const store = tx.objectStore('pending')
      const request = store.get(entry.record.roundId)
      request.onsuccess = () => {
        const previous = request.result as PendingRound | undefined
        if (previous && previous.record.revision >= entry.record.revision) { result(null); return }
        const next = { ...entry, blocked: previous?.blocked ?? entry.blocked }
        store.put(next)
        result(next)
      }
    })
  },
  list() {
    return transaction(['pending'], false, (tx, result) => {
      const request = tx.objectStore('pending').getAll()
      request.onsuccess = () => result(request.result)
    })
  },
  removeIfRevision(id, revision) { return update(id, revision, (_entry, store) => { store.delete(id) }) },
  async blockIfRevision(id, revision, blocked, valid = () => true) {
    await update(id, revision, (entry, store) => { if (valid()) store.put({ ...entry, blocked }) })
  },
  unblockAccount(username, valid) {
    return transaction(['pending'], true, (tx, result) => {
      const request = tx.objectStore('pending').openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) { result(); return }
        const entry = cursor.value as PendingRound
        if (valid() && entry.blocked === 'account' && (entry.record.owner.kind === 'guest' || entry.record.owner.expectedUsername === username)) {
          delete entry.blocked
          cursor.update(entry)
        }
        cursor.continue()
      }
    })
  },
  async migrate() {
    // Mark the exact imported revision atomically, so a failed legacy cleanup cannot resurrect an ACKed record.
    let keys: string[]
    try { keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((key): key is string => !!key?.startsWith(PREFIX)) }
    catch (error) { console.error('Legacy round queue unavailable.', error); return }
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const entry = JSON.parse(raw) as PendingRound
        const record = entry.record
        if (!record?.roundId || key !== PREFIX + record.roundId || !Number.isInteger(record.revision) || record.revision < 1 || !record.sessionId || !Array.isArray(record.actions) || !record.owner || !['guest', 'member'].includes(record.owner.kind) || (record.owner.kind === 'member' && !record.owner.expectedUsername) || (entry.blocked !== undefined && !['account', 'invalid'].includes(entry.blocked))) throw new Error('Invalid legacy round queue entry')
        await transaction<void>(['pending', 'legacyImports'], true, (tx, result) => {
          const markers = tx.objectStore('legacyImports')
          const marker = [key, record.revision]
          const seen = markers.get(marker)
          seen.onsuccess = () => {
            if (seen.result) { result(); return }
            const pending = tx.objectStore('pending')
            const previous = pending.get(record.roundId)
            previous.onsuccess = () => {
              if (!previous.result || previous.result.record.revision < record.revision) pending.put({ ...entry, blocked: previous.result?.blocked ?? entry.blocked })
              markers.put(true, marker)
              result()
            }
          }
        })
        if (localStorage.getItem(key) === raw) localStorage.removeItem(key)
      } catch (error) { console.error('Legacy round import failed; entry retained.', error) }
    }
  },
}
