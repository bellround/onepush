import { useEffect, useState } from 'react'
import { loadKeybindings } from '../game/keybindings.ts'
import { LEVELS } from '../levels/index.ts'

const PAGE_SIZE = 4

// 같은 이름의 분자는 처음 나오는 레벨 하나만 도감에 싣는다. index는 progress와 비교할 레벨 순서.
const ENTRIES = LEVELS.map((level, index) => ({ level, index })).filter(
  ({ level, index }) => LEVELS.findIndex((l) => l.moleculeName === level.moleculeName) === index,
)

export default function MoleculeDex({ progress, onBack }: { progress: number; onBack: () => void }) {
  const totalPages = Math.ceil(ENTRIES.length / PAGE_SIZE)
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

  const pageEntries = ENTRIES.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <section className="settings">
      <h1>분자 도감</h1>
      <p className="menu-tagline">지금까지 완성한 분자입니다.</p>
      <div className="dex-pager">
        <button type="button" className="btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
          ◀
        </button>
        <div className="dex-grid">
          {pageEntries.map(({ level, index }) =>
            index < progress ? (
              <div className="dex-card" key={level.id}>
                <strong className="dex-symbol">{level.moleculeName}</strong>
                {level.moleculeExplanation && <p className="dex-note">{level.moleculeExplanation}</p>}
              </div>
            ) : (
              <div className="dex-card dex-card--locked" key={level.id} />
            ),
          )}
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
