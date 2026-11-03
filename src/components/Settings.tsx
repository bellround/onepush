import { useEffect, useState } from 'react'
import {
  ACTION_LABELS,
  DEFAULT_KEYBINDINGS,
  keyLabel,
  loadKeybindings,
  saveKeybindings,
  type GameAction,
} from '../game/keybindings.ts'
import { isMuted, setMuted } from '../game/sfx.ts'

const ACTIONS = Object.keys(ACTION_LABELS) as GameAction[]

type View = 'menu' | 'controls' | 'data'

export default function Settings({
  onBack,
  resetMode,
  onReset,
}: {
  onBack: () => void
  resetMode: 'account' | 'guest' | null
  onReset: (password: string) => Promise<void>
}) {
  const [view, setView] = useState<View>('menu')
  const [bindings, setBindings] = useState(loadKeybindings)
  const [listening, setListening] = useState<GameAction | null>(null)
  const [muted, setMutedState] = useState(isMuted)
  const [resetPassword, setResetPassword] = useState('')
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetDone, setResetDone] = useState(false)

  async function reset() {
    if (resetBusy || !window.confirm('진행 상황을 모두 지우고 1레벨부터 다시 시작할까요? 되돌릴 수 없습니다.')) return
    setResetBusy(true)
    setResetError('')
    setResetDone(false)
    try {
      await onReset(resetPassword)
      setResetPassword('')
      setResetDone(true)
    } catch (error) {
      setResetError(error instanceof Error ? error.message : '진행 상황을 초기화하지 못했습니다.')
    } finally {
      setResetBusy(false)
    }
  }

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
      // 비밀번호를 입력하는 중에는 종료 키로 보지 않는다.
      if (e.target instanceof HTMLElement && e.target.closest('input')) return
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
        <h1>데이터</h1>
        {resetMode === 'account' && (
          <form className="account-form" onSubmit={(e) => { e.preventDefault(); void reset() }} aria-busy={resetBusy}>
            <p className="menu-tagline">진행 상황을 처음부터 다시 시작합니다. 본인 확인을 위해 비밀번호를 입력해 주세요.</p>
            <label htmlFor="reset-password">비밀번호</label>
            <input
              id="reset-password"
              type="password"
              autoComplete="current-password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              disabled={resetBusy}
              required
            />
            {resetError && <p role="alert">{resetError}</p>}
            {resetDone && <p role="status">진행 상황을 초기화했습니다.</p>}
            <button type="submit" className="btn" disabled={resetBusy || !resetPassword}>
              {resetBusy ? '초기화 중…' : '진행 상황 초기화'}
            </button>
          </form>
        )}
        {resetMode === 'guest' && (
          <>
            {/* .settings-actions는 가로 배치라 안내는 버튼 묶음 밖에 둔다. */}
            {resetDone && <p role="status">진행 상황을 초기화했습니다.</p>}
            <div className="settings-actions">
              <button type="button" className="btn" disabled={resetBusy} onClick={() => void reset()}>
                진행 상황 초기화
              </button>
            </div>
          </>
        )}
        <div className="settings-actions">
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
        <button
          type="button"
          className="btn"
          onClick={() => {
            const next = !muted
            setMutedState(next)
            setMuted(next)
          }}
        >
          효과음 : {muted ? '꺼짐' : '켜짐'}
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
