import { useEffect, useState } from 'react'
import { isCleared, pushTile } from '../game/board.ts'
import { keyLabel, loadKeybindings } from '../game/keybindings.ts'
import { finishRound, recordAction, recordClear, sendRound, startRound } from '../game/telemetry.ts'
import { LEVELS, loadLevel } from '../levels/index.ts'
import type { Board as BoardState, Direction } from '../game/types.ts'

// 레벨마다 그리드 크기(cols/rows)가 달라도 화면에 보이는 맵 전체 크기는 항상 이 고정값 안에서만
// 셀 크기를 다시 계산한다 (그리드가 커질수록 셀은 작아짐).
const BOARD_VIEW = 678
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']
// 이중·삼중 결합에서 결합선끼리 벌어지는 간격(px)
const BOND_GAP = 8

function levelState(index: number) {
  return { levelIndex: index, history: [] as BoardState[], ...loadLevel(LEVELS[index]) }
}

export default function Board({
  startLevelIndex,
  onExit,
}: {
  startLevelIndex: number
  onExit: (levelIndex: number, cleared: boolean) => void
}) {
  const [{ levelIndex, board, history, name, targetMolecule, explanation }, setLevel] = useState(() =>
    levelState(startLevelIndex),
  )
  const [bindings] = useState(loadKeybindings)
  const cleared = isCleared(board)

  // 리셋해도 같은 라운드다 — 이 컴포넌트가 살아있는 동안 하나의 기록만 쌓인다.
  const [run] = useState(() => startRound(LEVELS[startLevelIndex].id, startLevelIndex))

  useEffect(() => {
    if (cleared) recordClear(run)
  }, [cleared, run])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.code

      if (key === bindings.exit) {
        e.preventDefault()
        sendRound(finishRound(run, false))
        onExit(levelIndex, false)
        return
      }

      if (cleared && key === bindings.select) {
        e.preventDefault()
        sendRound(finishRound(run, true))
        onExit(levelIndex, true)
        return
      }

      if (key === bindings.undo) {
        e.preventDefault()
        if (history.length === 0) return
        recordAction(run, 'undo', null)
        setLevel((level) => ({
          ...level,
          board: level.history[level.history.length - 1],
          history: level.history.slice(0, -1),
        }))
        return
      }

      if (key === bindings.reset) {
        e.preventDefault()
        recordAction(run, 'reset', null)
        setLevel(levelState(levelIndex))
        return
      }

      const direction = DIRECTIONS.find((d) => bindings[d] === key)
      if (!direction) return
      e.preventDefault()
      const newBoard = pushTile(board, direction)
      if (newBoard === board) return
      recordAction(run, 'move', direction)
      setLevel((level) => ({ ...level, board: newBoard, history: [...level.history, board] }))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindings, board, cleared, history, levelIndex, onExit, run])

  const cellSize = Math.floor(BOARD_VIEW / Math.max(board.cols, board.rows))
  const atomSize = Math.round(cellSize * 0.8)
  const width = board.cols * cellSize
  const height = board.rows * cellSize
  const center = (row: number, col: number) => ({
    x: col * cellSize + cellSize / 2 + 5,
    y: row * cellSize + cellSize / 2 - 5,
  })

  return (
    <section className="board-screen">
      <p className="board-header">
        레벨: <strong>{name}</strong>
      </p>
      <div className="board-controls-hint">
        <p>되돌리기 : {keyLabel(bindings.undo)}</p>
        <p>리셋 : {keyLabel(bindings.reset)}</p>
      </div>
      <div className="board-viewport" style={{ width: BOARD_VIEW, height: BOARD_VIEW }}>
        <div
          className="board-grid"
          style={{
            width,
            height,
            backgroundImage:
              'linear-gradient(to right, #fff 5px, transparent 5px), linear-gradient(to bottom, #fff 5px, transparent 5px)',
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
                background: '#6b6375',
              }}
            />
          ))}
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            {board.bonds.flatMap((bond) => {
              const a = board.tiles.find((t) => t.id === bond.a)
              const b = board.tiles.find((t) => t.id === bond.b)
              if (!a || !b) return []
              const p1 = center(a.row, a.col)
              const p2 = center(b.row, b.col)
              // + 표시를 통한 대각선 결합도 있으므로 결합선에 수직인 방향으로 평행이동한다.
              const len = Math.hypot(p2.x - p1.x, p2.y - p1.y)
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
                    stroke="#000"
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
              style={{
                position: 'absolute',
                top: tile.row * cellSize + (cellSize - atomSize) / 2,
                left: tile.col * cellSize + (cellSize - atomSize) / 2,
                width: atomSize,
                height: atomSize,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                boxSizing: 'border-box',
                border: tile.id === board.controlledId ? '3px solid #000' : '3px solid #6b6375',
                background: tile.id === board.controlledId ? '#E8C9BE' : '#fff',
                transition: 'top 120ms, left 120ms',
              }}
            >
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
            <p className="clear-popup-hint">
              선택 키({keyLabel(bindings.select)}) : 레벨 선택 / 종료 키({keyLabel(bindings.exit)}) : 처음 화면
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
