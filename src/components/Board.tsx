import { useEffect, useState } from 'react'
import { isCleared, pushTile } from '../game/board.ts'
import { keyLabel, loadKeybindings } from '../game/keybindings.ts'
import { LEVELS, loadLevel } from '../levels/index.ts'
import type { Direction } from '../game/types.ts'

const CELL = 64
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']

function levelState(index: number) {
  return { levelIndex: index, ...loadLevel(LEVELS[index]) }
}

export default function Board({
  startLevelIndex,
  onExit,
}: {
  startLevelIndex: number
  onExit: (nextLevelIndex: number) => void
}) {
  const [{ levelIndex, board, name, targetMolecule }, setLevel] = useState(() => levelState(startLevelIndex))
  const [bindings] = useState(loadKeybindings)
  const cleared = isCleared(board)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()

      if (key === bindings.exit.toLowerCase()) {
        e.preventDefault()
        onExit(levelIndex)
        return
      }

      if (cleared && key === bindings.select.toLowerCase()) {
        e.preventDefault()
        const hasNext = levelIndex + 1 < LEVELS.length
        onExit(hasNext ? levelIndex + 1 : levelIndex)
        return
      }

      const direction = DIRECTIONS.find((d) => bindings[d].toLowerCase() === key)
      if (!direction) return
      e.preventDefault()
      setLevel((level) => ({ ...level, board: pushTile(level.board, direction) }))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindings, cleared, levelIndex, onExit])

  const width = board.cols * CELL
  const height = board.rows * CELL
  const center = (row: number, col: number) => ({
    x: col * CELL + CELL / 2,
    y: row * CELL + CELL / 2,
  })

  return (
    <section style={{ padding: 24 }}>
      <p>
        레벨: <strong>{name}</strong> · 목표 분자: <strong>{targetMolecule}</strong> (방향키로 조작 원소를 밀어보세요)
      </p>
      <div style={{ position: 'relative', width, height, background: '#f4f3ec', border: '1px solid #e5e4e7' }}>
        {board.walls.map((wall) => (
          <div
            key={`wall-${wall.row}-${wall.col}`}
            style={{
              position: 'absolute',
              top: wall.row * CELL,
              left: wall.col * CELL,
              width: CELL,
              height: CELL,
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
                stroke="#aa3bff"
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
              top: tile.row * CELL,
              left: tile.col * CELL,
              width: CELL,
              height: CELL,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              boxSizing: 'border-box',
              border: tile.id === board.controlledId ? '3px solid #aa3bff' : '2px solid #6b6375',
              background: '#fff',
              transition: 'top 120ms, left 120ms',
            }}
          >
            <strong>{tile.symbol}</strong>
            <small>{tile.remaining}</small>
          </div>
        ))}
      </div>
      {cleared && (
        <p>
          <strong>레벨 클리어!</strong> 선택 키({keyLabel(bindings.select)})를 누르면 처음 화면으로 돌아갑니다.
        </p>
      )}
    </section>
  )
}
