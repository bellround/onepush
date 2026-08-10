import { useEffect, useState } from 'react'
import { loadKeybindings } from '../game/keybindings.ts'
import { LEVELS } from '../levels/index.ts'

const PAGE_SIZE = 4

export default function MoleculeDex({ progress, onBack }: { progress: number; onBack: () => void }) {
  const totalPages = Math.ceil(LEVELS.length / PAGE_SIZE)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const bindings = loadKeybindings()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === bindings.exit) {
        e.preventDefault()
        onBack()
      } else if (e.code === bindings.left) {
        e.preventDefault()
        setPage((p) => Math.max(0, p - 1))
      } else if (e.code === bindings.right) {
        e.preventDefault()
        setPage((p) => Math.min(totalPages - 1, p + 1))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onBack, totalPages])

  const pageLevels = LEVELS.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <section className="settings">
      <h1>분자 도감</h1>
      <p className="menu-tagline">지금까지 완성한 분자입니다.</p>
      <div className="dex-pager">
        <button type="button" className="btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
          ◀
        </button>
        <div className="dex-grid">
          {pageLevels.map((level, i) => {
            const index = page * PAGE_SIZE + i
            return index < progress ? (
              <div className="dex-card" key={level.id}>
                <strong className="dex-symbol">{level.moleculeName}</strong>
                {level.moleculeExplanation && <p className="dex-note">{level.moleculeExplanation}</p>}
              </div>
            ) : (
              <div className="dex-card dex-card--locked" key={level.id} />
            )
          })}
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
        >
          ▶
        </button>
      </div>
      <button type="button" className="btn" onClick={onBack}>
        뒤로
      </button>
    </section>
  )
}
