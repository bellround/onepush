import { useEffect, useState } from 'react'
import {
  ACTION_LABELS,
  DEFAULT_KEYBINDINGS,
  keyLabel,
  loadKeybindings,
  saveKeybindings,
  type GameAction,
} from '../game/keybindings.ts'
import { resetProgress } from '../game/progress.ts'

const ACTIONS = Object.keys(ACTION_LABELS) as GameAction[]

type View = 'menu' | 'controls' | 'data'

export default function Settings({
  onBack,
  onResetProgress,
}: {
  onBack: () => void
  onResetProgress: () => void
}) {
  const [view, setView] = useState<View>('menu')
  const [bindings, setBindings] = useState(loadKeybindings)
  const [listening, setListening] = useState<GameAction | null>(null)

  useEffect(() => {
    if (!listening) return
    const action = listening
    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault()
      setBindings((prev) => {
        const next = { ...prev, [action]: e.code }
        saveKeybindings(next)
        return next
      })
      setListening(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [listening])

  // 키 입력을 기다리는 중이 아닐 때는 종료 키를 누르면 바로 처음 화면으로.
  useEffect(() => {
    if (listening) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === bindings.exit) {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindings.exit, listening, onBack])

  if (view === 'controls') {
    return (
      <section className="settings">
        <div>
          <h1>조작키</h1>
          <p className="menu-tagline">버튼을 누르고 원하는 키를 입력하면 조작 키가 바뀝니다.</p>
        </div>
        <div className="keybind-list">
          {ACTIONS.map((action) => (
            <div className="keybind-row" key={action}>
              <span className="keybind-label">{ACTION_LABELS[action]}</span>
              <button
                type="button"
                className={listening === action ? 'keycap listening' : 'keycap'}
                onClick={() => setListening(action)}
              >
                {listening === action ? '입력 대기…' : keyLabel(bindings[action])}
              </button>
            </div>
          ))}
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setBindings({ ...DEFAULT_KEYBINDINGS })
              saveKeybindings({ ...DEFAULT_KEYBINDINGS })
            }}
          >
            기본값으로 초기화
          </button>
          <button type="button" className="btn" onClick={() => setView('menu')}>
            뒤로
          </button>
        </div>
      </section>
    )
  }

  if (view === 'data') {
    return (
      <section className="settings">
        <div>
          <h1>데이터</h1>
          <p className="menu-tagline">저장된 진행 상황(어디까지 깼는지)을 초기화합니다.</p>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm('진행 데이터를 초기화할까요? 첫 레벨부터 다시 시작합니다.')) {
                resetProgress()
                onResetProgress()
              }
            }}
          >
            진행 데이터 초기화
          </button>
          <button type="button" className="btn" onClick={() => setView('menu')}>
            뒤로
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="settings">
      <h1>설정</h1>
      <div className="settings-actions">
        <button type="button" className="btn" onClick={() => setView('controls')}>
          조작키
        </button>
        <button type="button" className="btn" onClick={() => setView('data')}>
          데이터
        </button>
      </div>
      <button type="button" className="btn" onClick={onBack}>
        뒤로
      </button>
    </section>
  )
}
