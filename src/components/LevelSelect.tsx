import { useEffect, useState } from 'react'
import { loadKeybindings } from '../game/keybindings.ts'
import { LEVELS } from '../levels/index.ts'

export default function LevelSelect({
  progress,
  onSelect,
  onBack,
}: {
  progress: number
  onSelect: (levelIndex: number) => void
  onBack: () => void
}) {
  const [bindings] = useState(loadKeybindings)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === bindings.exit.toLowerCase()) {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindings.exit, onBack])

  return (
    <section className="settings">
      <h1>레벨 선택</h1>
      <div className="level-list">
        {LEVELS.map((level, index) => {
          const locked = index > progress
          return (
            <button
              key={level.id}
              type="button"
              className="btn level-item"
              disabled={locked}
              onClick={() => onSelect(index)}
            >
              {index + 1}. {level.name}
              {locked ? ' (잠김)' : ''}
            </button>
          )
        })}
      </div>
      <button type="button" className="btn" onClick={onBack}>
        뒤로
      </button>
    </section>
  )
}
