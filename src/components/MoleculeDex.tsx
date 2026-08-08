import { useEffect } from 'react'
import { loadKeybindings } from '../game/keybindings.ts'
import { LEVELS } from '../levels/index.ts'

// 지금까지 클리어한 레벨의 목표 분자만 모은다. progress는 "다음에 도전할 레벨 인덱스"라
// 그보다 앞선 레벨(index < progress)까지가 실제로 클리어한 분자다.
function clearedMolecules(progress: number) {
  return LEVELS.filter((_, index) => index < progress)
}

export default function MoleculeDex({ progress, onBack }: { progress: number; onBack: () => void }) {
  const molecules = clearedMolecules(progress)

  useEffect(() => {
    const bindings = loadKeybindings()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === bindings.exit) {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onBack])

  return (
    <section className="settings">
      <h1>분자 도감</h1>
      <p className="menu-tagline">지금까지 완성한 분자입니다.</p>
      <div className="dex-grid">
        {molecules.length === 0 && <p>아직 완성한 분자가 없습니다.</p>}
        {molecules.map((level) => (
          <div className="dex-card" key={level.id}>
            <strong className="dex-symbol">{level.moleculeName}</strong>
            {level.moleculeExplanation && <p className="dex-note">{level.moleculeExplanation}</p>}
          </div>
        ))}
      </div>
      <button type="button" className="btn" onClick={onBack}>
        뒤로
      </button>
    </section>
  )
}
