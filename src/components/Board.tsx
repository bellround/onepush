import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { interpolatePositions, MOVE_MS, type Position } from './boardAnimation.ts'
import { isCleared, pushTile } from '../game/board.ts'
import { ACTION_LABELS, keyLabel, loadKeybindings, type GameAction } from '../game/keybindings.ts'
import { swipeDirection } from '../game/swipe.ts'
import { checkpointRound, finishRound, recordAction, recordClear, sendRound, startRound } from '../game/telemetry.ts'
import { moveSound, play } from '../game/sfx.ts'
import { MenuIcon, ResetIcon, UndoIcon } from './icons.tsx'
import TutorialModal from './TutorialModal.tsx'
import { shouldStartTutorial } from '../game/tutorialModal.ts'
import { LEVELS, loadLevel } from '../levels/index.ts'
import type { Board as BoardState } from '../game/types.ts'

// 클리어 팝업에서 어디로 나가는가 — 'next'는 다음 레벨을 바로 시작한다.
export type ExitTarget = 'next' | 'levels' | 'start'

// 레벨마다 그리드 크기(cols/rows)가 달라도 화면에 보이는 맵 전체 크기는 항상 이 값 안에서만
// 셀 크기를 다시 계산한다 (그리드가 커질수록 셀은 작아짐).
const BOARD_VIEW_MAX = 678
// 이중·삼중 결합에서 결합선끼리 벌어지는 간격(px)
const BOND_GAP = 8
// 격자선 두께(px) — 셀 안쪽은 이 선 다음부터 시작한다.
const GRID_LINE = 5

function levelState(index: number) {
  return { levelIndex: index, history: [] as BoardState[], ...loadLevel(LEVELS[index]) }
}

export default function Board({
  startLevelIndex,
  onExit,
  onClear,
  saveNotice,
  username,
  guest,
  accountBusy,
}: {
  startLevelIndex: number
  onExit: (levelIndex: number, to: ExitTarget, cleared: boolean) => void
  onClear: (levelIndex: number, expectedUsername: string) => void
  saveNotice: ReactNode
  username: string
  guest: boolean
  accountBusy: boolean
}) {
  const [{ levelIndex, board, history, name, targetMolecule, explanation }, setLevel] = useState(() =>
    levelState(startLevelIndex),
  )
  const [bindings] = useState(loadKeybindings)
  const [playerUsername] = useState(username)
  const [tutorialOpen, setTutorialOpen] = useState(() => shouldStartTutorial(LEVELS[startLevelIndex].id, playerUsername))
  const cleared = isCleared(board)
  const clearReported = useRef(false)
  const exiting = useRef(false)
  const advancedOnExit = useRef(false)
  const [exitPending, setExitPending] = useState(false)
  const [displayPositions, setDisplayPositions] = useState<Position[]>(board.tiles)
  const displayed = useRef(displayPositions)
  // 판이 들어갈 실제 폭 — 좁은 화면에서는 이게 상한이 된다. innerWidth가 아니라 칸을 직접 재야
  // 회전·창 크기 변화는 물론 처음 그려질 때의 폭도 어긋나지 않는다.
  const viewportRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState(BOARD_VIEW_MAX)

  useLayoutEffect(() => {
    const element = viewportRef.current
    if (!element) return
    // .board-viewport는 폭이 100%라 view에 영향을 받지 않는다 — 되먹임 없음.
    const measure = () => setView(Math.min(BOARD_VIEW_MAX, element.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    displayed.current = displayPositions
  }, [displayPositions])

  useLayoutEffect(() => {
    const from = displayed.current
    const started = performance.now()
    let frame: number
    const tick = (now: number) => {
      setDisplayPositions(interpolatePositions(from, board.tiles, now - started))
      if (now - started < MOVE_MS) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [board.tiles])

  // 리셋해도 같은 라운드다 — 이 컴포넌트가 살아있는 동안 하나의 기록만 쌓인다.
  const [run] = useState(() => startRound(LEVELS[startLevelIndex].id, startLevelIndex, Date.now(),
    guest ? { kind: 'guest' } : { kind: 'member', expectedUsername: playerUsername }))

  const captureClear = useCallback((nextBoard: BoardState) => {
    if (exiting.current || run.clearMs !== null || !isCleared(nextBoard)) return false
    recordClear(run)
    void sendRound(checkpointRound(run))
    return true
  }, [run])

  useEffect(() => {
    if (!exiting.current) void sendRound(checkpointRound(run))
  }, [run])

  useEffect(() => {
    if (!cleared || clearReported.current) return
    clearReported.current = true
    captureClear(board)
    play('clear')
    onClear(levelIndex, playerUsername)
  }, [cleared, board, captureClear, onClear, levelIndex, playerUsername])

  useEffect(() => {
    const pagehide = () => { void sendRound(finishRound(run, advancedOnExit.current), true) }
    window.addEventListener('pagehide', pagehide)
    return () => window.removeEventListener('pagehide', pagehide)
  }, [run])

  const exit = useCallback(async (to: ExitTarget) => {
    if (exiting.current || accountBusy) return
    exiting.current = true
    // 클리어 후 넘어간 경우만 advanced — 메뉴로 나가는 것은 아니다.
    const advanced = to !== 'start'
    advancedOnExit.current = advanced
    setExitPending(true)
    await sendRound(finishRound(run, advanced))
    // cleared도 넘긴다 — 'start'는 클리어 후 "메뉴로"와 중간에 그만두기 둘 다라서 구분이 필요하다.
    onExit(levelIndex, to, cleared)
  }, [run, onExit, levelIndex, accountBusy, cleared])

  // 조작을 받지 않는 상태 — 튜토리얼 중, 나가는 중, 계정 작업 중.
  const blocked = useCallback(() => tutorialOpen || exiting.current || accountBusy, [tutorialOpen, accountBusy])

  // 키보드·스와이프·조이스틱·버튼이 모두 여기로 들어온다 — 기록과 사운드가 입력 수단마다 갈라지지 않게.
  const perform = useCallback((action: GameAction) => {
    if (blocked()) return

    if (action === 'exit') {
      void exit('start')
      return
    }

    if (action === 'select') {
      if (cleared) void exit('levels')
      return
    }

    if (action === 'undo') {
      if (history.length === 0) return
      recordAction(run, 'undo', null, null)
      if (!captureClear(history[history.length - 1])) void sendRound(checkpointRound(run))
      play('undo')
      setLevel((level) => ({
        ...level,
        board: level.history[level.history.length - 1],
        history: level.history.slice(0, -1),
      }))
      return
    }

    if (action === 'reset') {
      recordAction(run, 'reset', null, null)
      const reset = levelState(levelIndex)
      if (!captureClear(reset.board)) void sendRound(checkpointRound(run))
      play('reset')
      setLevel(reset)
      return
    }

    const newBoard = pushTile(board, action)
    play(moveSound(board, newBoard))
    if (newBoard === board) return
    recordAction(run, 'move', action, newBoard)
    if (!captureClear(newBoard)) void sendRound(checkpointRound(run))
    setLevel((level) => ({ ...level, board: newBoard, history: [...level.history, board] }))
  }, [blocked, board, cleared, history, levelIndex, exit, run, captureClear])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (blocked()) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, button, form')) return
      const action = (Object.keys(bindings) as GameAction[]).find((a) => bindings[a] === e.code)
      if (!action) return
      // 클리어 전 선택 키는 원래 아무 동작도 없었다 — 기본 동작도 막지 않는다.
      if (action === 'select' && !cleared) return
      e.preventDefault()
      perform(action)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindings, cleared, blocked, perform])

  // 보드 드래그 — 한 제스처에 한 칸.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (event: React.TouchEvent) => {
    touchStart.current = event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : null
  }
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || event.changedTouches.length !== 1) return
    const direction = swipeDirection(
      event.changedTouches[0].clientX - start.x,
      event.changedTouches[0].clientY - start.y,
    )
    if (direction) perform(direction)
  }

  const cellSize = Math.floor(view / Math.max(board.cols, board.rows))
  const atomSize = Math.round((cellSize - GRID_LINE) * 0.8)
  const width = board.cols * cellSize
  const height = board.rows * cellSize
  const hasNextLevel = levelIndex + 1 < LEVELS.length
  // 셀 안쪽(격자선 제외) 한가운데
  const center = (row: number, col: number) => ({
    x: col * cellSize + GRID_LINE + (cellSize - GRID_LINE) / 2,
    y: row * cellSize + GRID_LINE + (cellSize - GRID_LINE) / 2,
  })
  const tileCenter = (tile: Position) => {
    const position = displayPositions.find((p) => p.id === tile.id) ?? tile
    return center(position.row, position.col)
  }

  return (
    <section className="board-screen">
      <p className="board-header">
        레벨: <strong>{name}</strong>
      </p>
      {!cleared && saveNotice && <div inert={exitPending}>{saveNotice}</div>}
      <div className="board-controls-hint" data-tutorial="recovery">
        <p>되돌리기 : {keyLabel(bindings.undo)}</p>
        <p>리셋 : {keyLabel(bindings.reset)}</p>
      </div>
      {/* 모바일 전용 조작 — 데스크톱에서는 CSS가 숨긴다. */}
      <div className="board-mobile-controls">
        <div className="board-mobile-top">
          <button type="button" className="board-icon-btn" aria-label="메뉴" onClick={() => perform('exit')}>
            <MenuIcon />
          </button>
          <button type="button" className="board-icon-btn" aria-label={ACTION_LABELS.reset} onClick={() => perform('reset')}>
            <ResetIcon />
          </button>
        </div>
        <button
          type="button"
          className="board-icon-btn board-undo-btn"
          aria-label={ACTION_LABELS.undo}
          disabled={history.length === 0}
          onClick={() => perform('undo')}
        >
          <UndoIcon />
        </button>
      </div>
      <TutorialModal open={tutorialOpen} onOpenChange={setTutorialOpen} username={playerUsername} />
      {/* 가로는 칸이 주는 폭을 그대로 쓰고, 세로는 격자만큼만 — 아래 안내가 창 밖으로 밀리지 않게. */}
      <div className="board-viewport" ref={viewportRef} style={{ height }}>
        <div
          className="board-grid"
          data-tutorial="goal"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            width,
            height,
            backgroundImage:
              'linear-gradient(to right, var(--board-grid-line) 5px, var(--transparent) 5px), linear-gradient(to bottom, var(--board-grid-line) 5px, var(--transparent) 5px)',
            backgroundSize: `${cellSize}px ${cellSize}px`,
          }}
        >
          {board.walls.map((wall) => (
            <div
              key={`wall-${wall.row}-${wall.col}`}
              style={{
                position: 'absolute',
                top: wall.row * cellSize + 5,
                left: wall.col * cellSize + 5,
                width: cellSize - 5,
                height: cellSize - 5,
                background: 'var(--wall)',
              }}
            />
          ))}
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            {board.bonds.flatMap((bond) => {
              const a = board.tiles.find((t) => t.id === bond.a)
              const b = board.tiles.find((t) => t.id === bond.b)
              if (!a || !b) return []
              const p1 = tileCenter(a)
              const p2 = tileCenter(b)
              // + 표시를 통한 대각선 결합도 있으므로 결합선에 수직인 방향으로 평행이동한다.
              const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1
              const ox = (-(p2.y - p1.y) / len) * BOND_GAP
              const oy = ((p2.x - p1.x) / len) * BOND_GAP
              return Array.from({ length: bond.order }, (_, i) => {
                const shift = i - (bond.order - 1) / 2
                return (
                  <line
                    key={`${bond.a}-${bond.b}-${i}`}
                    x1={p1.x + ox * shift}
                    y1={p1.y + oy * shift}
                    x2={p2.x + ox * shift}
                    y2={p2.y + oy * shift}
                    stroke="var(--bond-line)"
                    strokeWidth={4}
                  />
                )
              })
            })}
          </svg>
          {/* 맵에 고정된 + 표시 — 격자 모서리(격자선이 교차하는 꼭짓점)에 그린다. */}
          {board.bonders.map((bonder) => {
            const size = Math.max(16, Math.round(cellSize * 0.2))
            return (
              <div
                key={`bonder-${bonder.row}-${bonder.col}`}
                className="bonder"
                aria-hidden="true"
                style={{
                  top: bonder.row * cellSize + 2.5 - size / 2,
                  left: bonder.col * cellSize + 2.5 - size / 2,
                  width: size,
                  height: size,
                  fontSize: Math.round(size * 0.6),
                }}
              >
                +
              </div>
            )
          })}
          {board.tiles.map((tile) => (
            <div
              key={tile.id}
              data-tutorial={tile.id === board.controlledId ? 'player' : undefined}
              style={{
                position: 'absolute',
                top: tileCenter(tile).y - atomSize / 2,
                left: tileCenter(tile).x - atomSize / 2,
                width: atomSize,
                height: atomSize,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                boxSizing: 'border-box',
                border:
                  tile.id === board.controlledId ? '2.8px solid var(--transparent)' : '2.8px solid var(--atom-border)',
                background: `var(--el-${tile.symbol.toLowerCase()}, var(--atom-fallback))`,
                backgroundClip: 'padding-box', // 검은 C에서도 조종 점선이 묻히지 않게
                color: ['O', 'N', 'C'].includes(tile.symbol) ? 'var(--text-on-color)' : undefined,
              }}
            >
              {tile.id === board.controlledId && (
                <svg className="atom-ring" viewBox="0 0 100 100" aria-hidden="true">
                  {/* pathLength=100 덕분에 dasharray를 둘레의 % 로 쓸 수 있다 — 4토막 점선 */}
                  <circle cx="50" cy="50" r="48.5" pathLength={100} strokeDasharray="3.5 2.2" />
                </svg>
              )}
              <strong style={{ fontSize: Math.round(atomSize * 0.23) }}>{tile.symbol}</strong>
              <small style={{ fontSize: Math.round(atomSize * 0.135) }}>{tile.remaining}</small>
            </div>
          ))}
        </div>
      </div>
      {cleared && (
        <div className="clear-popup">
          <div className="clear-popup-card">
            <h2>클리어! {targetMolecule}</h2>
            <p>{explanation ? explanation : '(설명 준비 중)'}</p>
            {saveNotice && <div inert={exitPending}>{saveNotice}</div>}
            <div className="clear-popup-actions">
              {hasNextLevel && (
                <button type="button" className="btn btn--primary" disabled={exitPending} onClick={() => void exit('next')}>
                  다음 단계로
                </button>
              )}
              <button type="button" className="btn btn--outline" disabled={exitPending} onClick={() => void exit('levels')}>
                챕터로
              </button>
              <button type="button" className="btn btn--outline" disabled={exitPending} onClick={() => void exit('start')}>
                메뉴로
              </button>
            </div>
            <p className="clear-popup-hint">
              선택 키({keyLabel(bindings.select)}) : 레벨 선택 / 종료 키({keyLabel(bindings.exit)}) : 처음 화면
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
