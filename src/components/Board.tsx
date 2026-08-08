import { useEffect, useState } from 'react'
import { isCleared, pushTile } from '../game/board.ts'
import { keyLabel, loadKeybindings } from '../game/keybindings.ts'
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
  onExit: (nextLevelIndex: number) => void
}) {
  const [{ levelIndex, board, name, targetMolecule, explanation }, setLevel] = useState(() =>
    levelState(startLevelIndex),
  )
  const [bindings] = useState(loadKeybindings)
  const cleared = isCleared(board)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.code

      if (key === bindings.exit) {
        e.preventDefault()
        onExit(levelIndex)
        return
      }

      if (cleared && key === bindings.select) {
        e.preventDefault()
        const hasNext = levelIndex + 1 < LEVELS.length
        onExit(hasNext ? levelIndex + 1 : levelIndex)
        return
      }

      if (key === bindings.undo) {
        e.preventDefault()
        setLevel((level) => {
          if (level.history.length === 0) return level
          const prevBoard = level.history[level.history.length - 1]
          return { ...level, board: prevBoard, history: level.history.slice(0, -1) }
        })
        return
      }

      if (key === bindings.reset) {
        e.preventDefault()
        setLevel(levelState(levelIndex))
        return
      }

      const direction = DIRECTIONS.find((d) => bindings[d] === key)
      if (!direction) return
      e.preventDefault()
      setLevel((level) => {
        const newBoard = pushTile(level.board, direction)
        if (newBoard === level.board) return level
        return { ...level, board: newBoard, history: [...level.history, level.board] }
      })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindings, cleared, levelIndex, onExit])

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
                border: tile.id === board.controlledId ? '2px solid #000' : '2px solid #6b6375',
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
              선택 키({keyLabel(bindings.select)})를 누르면 처음 화면으로 돌아갑니다.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
