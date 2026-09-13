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
            {board.bonds.map((bond) => {
              const a = board.tiles.find((t) => t.id === bond.a)
              const b = board.tiles.find((t) => t.id === bond.b)
              if (!a || !b) return null
              const p1 = center(a.row, a.col)
              const p2 = center(b.row, b.col)
              return (
                <line
                  key={`${bond.a}-${bond.b}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#000"
                  strokeWidth={4}
                />
              )
            })}
          </svg>
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
