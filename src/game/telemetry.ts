import type { Board, Direction } from './types.ts'
import { apiUrl } from '../platform.ts'

// 한 라운드(= 레벨 1회 플레이) 동안 일어난 조작 하나.
export interface RoundAction {
  kind: 'move' | 'undo' | 'reset'
  direction: Direction | null // move일 때만 방향이 있다
  t: number // 라운드 시작 후 경과 ms
  board: Board | null // move 직후 보드 전체 스냅샷 (undo/reset은 null)
}

// 플레이 중 쌓아가는 진행 상태 (mutable).
export interface RoundRun {
  roundId: string
  revision: number
  owner: RoundOwner
  levelId: string
  levelIndex: number
  startedAt: number
  actions: RoundAction[]
  clearMs: number | null
}

// 라운드가 끝날 때 서버로 보내는 한 줄.
export interface RoundRecord {
  roundId: string
  revision: number
  owner: RoundOwner
  levelId: string
  levelIndex: number
  cleared: boolean
  clearMs: number | null // 클리어까지 걸린 시간, 못 깼으면 null
  quitMs: number | null // 포기(종료) 시점, 깼으면 null
  advancedAfterClear: boolean // 클리어 후 선택 키로 넘어갔는가
  resetCount: number
  undoCount: number
  firstMoveMs: number | null // 시작 후 첫 수까지 걸린 시간
  maxGapMs: number | null // 수와 수 사이 가장 긴 간격
  actions: RoundAction[]
}

export type RoundOwner = { kind: 'guest' } | { kind: 'member'; expectedUsername: string }

export function startRound(levelId: string, levelIndex: number, now = Date.now(), owner: RoundOwner = { kind: 'guest' }): RoundRun {
  return { roundId: crypto.randomUUID(), revision: 0, owner: { ...owner }, levelId, levelIndex, startedAt: now, actions: [], clearMs: null }
}

export function recordAction(
  run: RoundRun,
  kind: RoundAction['kind'],
  direction: Direction | null,
  board: Board | null,
  now = Date.now(),
): void {
  run.actions.push({ kind, direction, t: now - run.startedAt, board })
}

// 클리어 판정은 렌더마다 다시 계산되므로 첫 호출만 남긴다.
export function recordClear(run: RoundRun, now = Date.now()): void {
  if (run.clearMs === null) run.clearMs = now - run.startedAt
}

export function finishRound(run: RoundRun, advancedAfterClear: boolean, now = Date.now()): RoundRecord {
  const moves = run.actions.filter((a) => a.kind === 'move')
  let maxGapMs: number | null = null
  for (let i = 1; i < moves.length; i++) {
    const gap = moves[i].t - moves[i - 1].t
    if (maxGapMs === null || gap > maxGapMs) maxGapMs = gap
  }
  return {
    roundId: run.roundId,
    revision: ++run.revision,
    owner: { ...run.owner },
    levelId: run.levelId,
    levelIndex: run.levelIndex,
    cleared: run.clearMs !== null,
    clearMs: run.clearMs,
    quitMs: run.clearMs === null ? now - run.startedAt : null,
    advancedAfterClear,
    resetCount: run.actions.filter((a) => a.kind === 'reset').length,
    undoCount: run.actions.filter((a) => a.kind === 'undo').length,
    firstMoveMs: moves.length > 0 ? moves[0].t : null,
    maxGapMs,
    actions: structuredClone(run.actions),
  }
}

const SESSION_KEY = 'sessionId'

// 브라우저 탭 단위 식별자. 진행도(progress.ts)와 달리 탭을 닫으면 사라진다.
function sessionId(): string {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) return saved
    const id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

const QUEUE_PREFIX = 'round-queue:v1:'
interface PendingRound {
  record: RoundRecord & { sessionId: string }
  blocked?: 'account' | 'invalid'
}
export type DeliveryResult = 'sent' | 'queued' | 'storage-error'
let confirmedUsername: string | null = null
let accountVersion = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryAttempt = 0
let running = false
let keepaliveBytes = 0
const inFlight = new Set<string>()

function storageFailure(error: unknown): void {
  console.error('Round queue storage failed; recording is not guaranteed.', error)
}

function pendingRounds(): PendingRound[] {
  const entries: PendingRound[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(QUEUE_PREFIX)) continue
    try {
      const entry = JSON.parse(localStorage.getItem(key)!) as PendingRound
      if (entry.record?.roundId && entry.record.owner) entries.push(entry)
    } catch (error) { storageFailure(error) }
  }
  return entries
}

function scheduleRetry(): void {
  if (!running || retryTimer || retryAttempt >= 5) return
  retryTimer = setTimeout(() => {
    retryTimer = undefined
    void flushRounds()
  }, Math.min(1000 * 2 ** retryAttempt++, 30000))
}

async function deliver(entry: PendingRound, pagehide = false): Promise<DeliveryResult> {
  const { record } = entry
  if (entry.blocked || (record.owner.kind === 'member' && record.owner.expectedUsername !== confirmedUsername)) return 'queued'
  const key = QUEUE_PREFIX + record.roundId
  const flight = `${key}:${record.revision}`
  if (inFlight.has(flight)) return 'queued'
  const body = JSON.stringify({ ...record, ...(record.owner.kind === 'member' ? { expectedUsername: record.owner.expectedUsername } : {}) })
  const bytes = new TextEncoder().encode(body).byteLength
  // Leave headroom for other keepalive users sharing the browser's 64 KiB budget.
  if (pagehide && keepaliveBytes + bytes > 48 * 1024) return 'queued'
  inFlight.add(flight)
  if (pagehide) keepaliveBytes += bytes
  const version = accountVersion
  try {
    const response = await fetch(apiUrl('/rounds'), {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body,
      signal: AbortSignal.timeout(5000), ...(pagehide ? { keepalive: true } : {}),
    }).catch(() => null)
    if (!response) {
      scheduleRetry()
      return 'queued'
    }
    const current = JSON.parse(localStorage.getItem(key) ?? 'null') as PendingRound | null
    if (current?.record.revision !== record.revision) return 'queued'
    if (response.ok) {
      localStorage.removeItem(key)
      return 'sent'
    }
    if (response.status === 401 || response.status === 409) {
      if (version === accountVersion) {
        current.blocked = 'account'
        localStorage.setItem(key, JSON.stringify(current))
      } else scheduleRetry()
    } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      current.blocked = 'invalid'
      localStorage.setItem(key, JSON.stringify(current))
    } else scheduleRetry()
  } catch (error) {
    storageFailure(error)
    scheduleRetry()
    return 'storage-error'
  } finally {
    inFlight.delete(flight)
    if (pagehide) keepaliveBytes -= bytes
  }
  return 'queued'
}

export function sendRound(record: RoundRecord, pagehide = false): Promise<DeliveryResult> {
  try {
    const key = QUEUE_PREFIX + record.roundId
    const previous = JSON.parse(localStorage.getItem(key) ?? 'null') as PendingRound | null
    if (previous && previous.record.revision >= record.revision) return Promise.resolve('queued')
    const entry: PendingRound = { record: { ...structuredClone(record), sessionId: sessionId() }, blocked: previous?.blocked }
    localStorage.setItem(key, JSON.stringify(entry))
    return deliver(entry, pagehide)
  } catch (error) {
    storageFailure(error)
    return Promise.resolve('storage-error')
  }
}

export async function flushRounds(): Promise<void> {
  try { await Promise.all(pendingRounds().map(entry => deliver(entry))) }
  catch (error) { storageFailure(error) }
}

// Call only after a successful session lookup/login, never from a cached username.
export function confirmRoundAccount(username: string | null): void {
  confirmedUsername = username
  accountVersion++
  retryAttempt = 0
  try {
    for (const entry of pendingRounds()) {
      if (entry.blocked === 'account' && (entry.record.owner.kind === 'guest' || entry.record.owner.expectedUsername === username)) {
        delete entry.blocked
        localStorage.setItem(QUEUE_PREFIX + entry.record.roundId, JSON.stringify(entry))
      }
    }
  } catch (error) { storageFailure(error) }
  void flushRounds()
}

export function suspendRoundAccount(): void {
  confirmedUsername = null
  accountVersion++
}

export function startRoundDelivery(): () => void {
  running = true
  const online = () => { retryAttempt = 0; void flushRounds() }
  window.addEventListener('online', online)
  void flushRounds()
  return () => {
    running = false
    window.removeEventListener('online', online)
    clearTimeout(retryTimer)
    retryTimer = undefined
  }
}
