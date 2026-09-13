import type { Board, Direction } from './types.ts'

// 한 라운드(= 레벨 1회 플레이) 동안 일어난 조작 하나.
export interface RoundAction {
  kind: 'move' | 'undo' | 'reset'
  direction: Direction | null // move일 때만 방향이 있다
  t: number // 라운드 시작 후 경과 ms
  board: Board | null // move 직후 보드 전체 스냅샷 (undo/reset은 null)
}

// 플레이 중 쌓아가는 진행 상태 (mutable).
export interface RoundRun {
  levelId: string
  levelIndex: number
  startedAt: number
  actions: RoundAction[]
  clearMs: number | null
}

// 라운드가 끝날 때 서버로 보내는 한 줄.
export interface RoundRecord {
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

export function startRound(levelId: string, levelIndex: number, now = Date.now()): RoundRun {
  return { levelId, levelIndex, startedAt: now, actions: [], clearMs: null }
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
    actions: run.actions,
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

// 전송 실패는 무시한다 — 기록 때문에 게임이 멈추면 안 된다.
export function sendRound(record: RoundRecord): void {
  fetch('/api/rounds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...record, sessionId: sessionId() }),
    keepalive: true,
  }).catch(() => {})
}
