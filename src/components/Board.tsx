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
import { MOBILE_QUERY } from '../useIsMobile.ts'
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
// 판 말고 세로로 비워 둘 자리(px). 데스크톱: 판이 세로 가운데라 위(키 안내)·아래(레벨 이름) 80씩.
// 모바일: .board-screen padding(76+110) + 맨 위 레벨 이름 줄과 gap.
const HEIGHT_RESERVE = 160
const HEIGHT_RESERVE_MOBILE = 240
// 가로폰: App.css가 같은 조건에서 padding을 16으로 줄인다 — 여백 32 + 레벨 이름 줄과 gap.
const LANDSCAPE_QUERY = '(pointer: coarse) and (orientation: landscape) and (max-height: 500px)'
const HEIGHT_RESERVE_LANDSCAPE = 100

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
    // 높이도 본다 — 폭만 보면 낮은 창에서 판이 위아래 안내 글자를 덮는다.
    const measure = () => {
      const reserve = window.matchMedia(LANDSCAPE_QUERY).matches
        ? HEIGHT_RESERVE_LANDSCAPE
        : window.matchMedia(MOBILE_QUERY).matches
          ? HEIGHT_RESERVE_MOBILE
          : HEIGHT_RESERVE
      setView(Math.min(BOARD_VIEW_MAX, element.clientWidth, window.innerHeight - reserve))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    // 높이만 바뀌면 칸 폭은 그대로라 ResizeObserver가 안 불린다.
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
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

  // 화면 어디서든 드래그 — 한 제스처에 한 칸. 판 바깥 빈 곳에서 그어도 움직인다.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (event: React.TouchEvent) => {
    // 버튼과 클리어 팝업 위는 제외 — 거기선 누르는 게 목적이다.
    if (
      event.touches.length !== 1 ||
      !(event.target instanceof Element) ||
      event.target.closest('button, .clear-popup')
    ) {
      touchStart.current = null
      return
    }
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
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
  const inner = cellSize - GRID_LINE
  // 셀이 작을수록 원이 셀을 더 많이 차지하게 — 데스크톱(inner 91)에서는 0.8 비율 그대로 73px.
  const atomSize = Math.min(inner - 2, Math.max(40, Math.round(inner * 0.8)))
  // 테두리·점선 간격이 고정 px이면 작은 원에서 원을 잡아먹는다. 아래 계수는 원자 73px에서 현행과 같은 값.
  // (점선 두께는 CSS에서 viewBox 단위로 둬서 저절로 비례한다)
  const atomStroke = Math.max(1.2, atomSize * 0.0384)
  const ringInset = Math.max(1.2, atomSize * 0.0411)
  // :root의 line-height(145%)는 18px 기준 26.1px 길이로 상속된다 — 작은 원에서는 글자 상자가
  // 원보다 커진다. 지름에 비례시키면 원자 73px에서 지금과 같은 26.1px가 나온다.
  const labelLine = atomSize * 0.3575
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
    <section className="board-screen" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
          data-tutorial="recovery-touch"
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
                border: `${atomStroke}px solid ${
                  tile.id === board.controlledId ? 'var(--transparent)' : 'var(--atom-border)'
                }`,
                background: `var(--el-${tile.symbol.toLowerCase()}, var(--atom-fallback))`,
                backgroundClip: 'padding-box', // 검은 C에서도 조종 점선이 묻히지 않게
                color: ['O', 'N', 'C'].includes(tile.symbol) ? 'var(--text-on-color)' : undefined,
              }}
            >
              {tile.id === board.controlledId && (
                <svg className="atom-ring" viewBox="0 0 100 100" aria-hidden="true" style={{ inset: -ringInset }}>
                  {/* pathLength=100 덕분에 dasharray를 둘레의 % 로 쓸 수 있다 — 어느 크기든 토막 수가 같다 */}
                  <circle cx="50" cy="50" r="47.9" pathLength={100} strokeDasharray="3.5 2.2" />
                </svg>
              )}
              <strong style={{ fontSize: Math.max(11, Math.round(atomSize * 0.23)), lineHeight: `${labelLine}px` }}>{tile.symbol}</strong>
              <small style={{ fontSize: Math.max(8, Math.round(atomSize * 0.135)), lineHeight: `${labelLine}px` }}>{tile.remaining}</small>
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
