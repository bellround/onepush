import { useCallback, useEffect, useRef, useState } from 'react'
import Board from './components/Board.tsx'
import LevelSelect from './components/LevelSelect.tsx'
import Settings from './components/Settings.tsx'
import MoleculeDex from './components/MoleculeDex.tsx'
import { AccountError, enterAccount, getAccount, logoutAccount, saveAccountProgress, type PlayerAccount } from './game/account.ts'
import { LEVELS } from './levels/index.ts'
import './App.css'

type Screen = 'start' | 'account' | 'settings' | 'playing' | 'levels' | 'dex'

function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [account, setAccount] = useState<PlayerAccount | null>(null)
  const progress = account?.progress ?? 0
  const [busy, setBusy] = useState(true)
  const [restored, setRestored] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const generation = useRef(0)
  const authBusy = useRef(false)
  const saving = useRef(false)
  const [save, setSave] = useState<{ index: number; username: string; status: 'pending' | 'error' | 'saved'; error?: string; reauthenticate?: boolean } | null>(null)
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [recoveryError, setRecoveryError] = useState('')
  const [playingIndex, setPlayingIndex] = useState(0)
  // 이번 세션에 방금 깬 레벨 — 레벨 선택 화면을 그 챕터에서 열기 위한 기준.
  const [lastCleared, setLastCleared] = useState<number | null>(null)

  const restore = useCallback(async () => {
    const request = ++generation.current
    setBusy(true)
    setError('')
    try {
      const result = await getAccount()
      if (request !== generation.current) return
      setAccount(result)
      setRestored(true)
    } catch (error) {
      if (request === generation.current) setError(error instanceof Error ? error.message : '계정을 불러오지 못했습니다.')
    } finally {
      if (request === generation.current) setBusy(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getAccount().then(result => {
      if (!active) return
      setAccount(result)
      setRestored(true)
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : '계정을 불러오지 못했습니다.')
    }).finally(() => {
      if (active) setBusy(false)
    })
    return () => { active = false }
  }, [])

  async function enter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (authBusy.current || !username.trim() || !password) return
    authBusy.current = true
    const request = ++generation.current
    setBusy(true)
    setError('')
    try {
      const result = await enterAccount(username.trim(), password)
      if (request !== generation.current) return
      setAccount(result)
      setLastCleared(null)
      setSave(null)
      setPassword('')
      setScreen('levels')
    } catch (error) {
      if (request === generation.current) setError(error instanceof Error ? error.message : '계속할 수 없습니다. 다시 시도해 주세요.')
    } finally {
      authBusy.current = false
      if (request === generation.current) setBusy(false)
    }
  }

  async function logout() {
    if (authBusy.current || saving.current || (save && save.status !== 'saved')) return
    authBusy.current = true
    const request = ++generation.current
    setBusy(true)
    setError('')
    try {
      await logoutAccount()
      if (request !== generation.current) return
      setAccount(null)
      setLastCleared(null)
      setSave(null)
      setUsername('')
      setPassword('')
    } catch (error) {
      if (request === generation.current) setError(error instanceof Error ? error.message : '로그아웃하지 못했습니다.')
    } finally {
      authBusy.current = false
      if (request === generation.current) setBusy(false)
    }
  }

  const persistClear = useCallback(async (index: number, expectedUsername: string) => {
    if (saving.current) return
    saving.current = true
    const request = generation.current
    setLastCleared(index)
    setSave({ index, username: expectedUsername, status: 'pending' })
    try {
      const result = await saveAccountProgress(LEVELS[index].id, expectedUsername)
      if (request !== generation.current) return
      if (result.username !== expectedUsername) throw new AccountError('계정이 변경되었습니다. 다시 로그인해 주세요.', 409)
      setAccount(result)
      setSave({ index, username: expectedUsername, status: 'saved' })
    } catch (error) {
      if (request === generation.current) setSave({ index, username: expectedUsername, status: 'error', error: error instanceof Error ? error.message : '진행 상황을 저장하지 못했습니다.', reauthenticate: error instanceof AccountError && (error.status === 401 || error.status === 409) })
    } finally {
      saving.current = false
    }
  }, [])

  async function recover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!save || authBusy.current || saving.current || !recoveryPassword) return
    const pending = save
    const request = generation.current
    authBusy.current = true
    setBusy(true)
    setRecoveryError('')
    try {
      const result = await enterAccount(pending.username, recoveryPassword)
      if (request !== generation.current) return
      if (result.username !== pending.username) throw new Error('원래 계정으로 다시 로그인해 주세요.')
      setAccount(result)
      setRecoveryPassword('')
      await persistClear(pending.index, pending.username)
    } catch (error) {
      if (request === generation.current) setRecoveryError(error instanceof Error ? error.message : '다시 로그인하지 못했습니다.')
    } finally {
      authBusy.current = false
      if (request === generation.current) setBusy(false)
    }
  }

  const saveNotice = save && (
    <div className="account-save" onKeyDown={event => event.stopPropagation()}>
      <span role="status">{save.status === 'pending' ? '진행 상황 저장 중…' : save.status === 'saved' ? '진행 상황이 저장되었습니다.' : `${save.error} 저장되지 않았습니다.`}</span>
      {save.status === 'error' && <>
        {save.reauthenticate ? <form className="account-form" onSubmit={recover} aria-busy={busy}>
          <p>진행 상황을 저장하려면 원래 계정으로 다시 로그인해 주세요.</p>
          <label htmlFor="recovery-username">아이디</label>
          <input id="recovery-username" autoComplete="username" value={save.username} readOnly />
          <label htmlFor="recovery-password">비밀번호</label>
          <input id="recovery-password" type="password" autoComplete="current-password" value={recoveryPassword} onChange={event => setRecoveryPassword(event.target.value)} disabled={busy} required />
          {recoveryError && <p role="alert">{recoveryError}</p>}
          <button type="submit" className="btn" disabled={busy || !recoveryPassword}>{busy ? '확인 중…' : '다시 로그인하고 저장'}</button>
        </form> : <button type="button" className="btn" disabled={busy} onClick={() => void persistClear(save.index, save.username)}>저장 다시 시도</button>}
        <button type="button" className="btn" disabled={busy} onClick={() => {
          if (authBusy.current || saving.current || !window.confirm('저장하지 않은 이번 클리어 진행을 버릴까요?')) return
          generation.current++
          setSave(null)
          setRecoveryPassword('')
          setRecoveryError('')
        }}>저장하지 않은 진행 버리기</button>
      </>}
    </div>
  )

  if (screen === 'account') {
    return <section className="menu">
      <div>
        <h1>게임 시작</h1>
        <small className="account-entry-hint">처음이면 자동으로 가입됩니다</small>
      </div>
      <form className="account-form" onSubmit={enter} aria-busy={busy}>
        <label htmlFor="player-username">아이디</label>
        <input id="player-username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event => setUsername(event.target.value)} disabled={busy} required autoFocus />
        <label htmlFor="player-password">비밀번호</label>
        <input id="player-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required />
        {error && <p role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy || !username.trim() || !password}>{busy ? '확인 중…' : '계속'}</button>
      </form>
      <button className="btn" type="button" disabled={busy} onClick={() => { setPassword(''); setError(''); setScreen('start') }}>뒤로</button>
    </section>
  }

  if (screen === 'settings') {
    return (
      <Settings
        onBack={() => { if (!authBusy.current) setScreen('start') }}
      />
    )
  }

  if (screen === 'dex') {
    return <MoleculeDex progress={progress} onBack={() => setScreen('start')} />
  }

  if (screen === 'levels' && account) {
    return (
      <>
      {saveNotice}
      <LevelSelect
        progress={progress}
        focusLevel={lastCleared ?? Math.max(progress - 1, 0)}
        onSelect={(i) => {
          if (authBusy.current || saving.current || (save && save.status !== 'saved') || i > progress) return
          setSave(null)
          setPlayingIndex(i)
          setScreen('playing')
        }}
        onBack={() => { if (!authBusy.current) setScreen('start') }}
      />
      </>
    )
  }

  if (screen === 'playing' && account) {
    return (
      <Board
        startLevelIndex={playingIndex}
        username={account.username}
        accountBusy={busy}
        onClear={persistClear}
        saveNotice={saveNotice}
        onExit={(levelIndex, cleared) => {
          if (!cleared) {
            setScreen('start')
            return
          }
          setLastCleared(levelIndex)
          setScreen('levels')
        }}
      />
    )
  }

  return (
    <section className="menu">
      <div className="menu-orbit" aria-hidden="true">
        <span className="nucleus" />
        <div className="ring">
          <span className="electron h" />
          <span className="electron o" />
          <span className="electron n" />
          <span className="electron c" />
        </div>
      </div>
      <div>
        <p className="menu-eyebrow">통합과학1</p>
        <h1>원소결합 퍼즐</h1>
        <p className="menu-tagline">
          원소 타일을 밀어 인접시키고, 원자가전자 규칙에 맞게 결합시켜 목표 분자를 완성하세요.
        </p>
      </div>
      <div className="menu-actions">
        <button
          type="button"
          className="btn"
          disabled={busy || !restored || (save !== null && save.status !== 'saved')}
          onClick={() => { setError(''); setScreen(account ? 'levels' : 'account') }}
        >
          게임 시작
        </button>
        <button type="button" className="btn" onClick={() => setScreen('dex')}>
          분자 도감
        </button>
        <button type="button" className="btn" onClick={() => setScreen('settings')}>
          설정
        </button>
      </div>
      {busy && <p role="status">계정 확인 중…</p>}
      {error && <p role="alert">{error}</p>}
      {!restored && !busy && <button type="button" className="btn" onClick={() => void restore()}>계정 다시 불러오기</button>}
      {saveNotice}
      {account && <div className="account-identity">
        <span><strong>{account.username}</strong> 님</span>
        <button type="button" className="btn" disabled={busy || (save !== null && save.status !== 'saved')} onClick={() => void logout()}>로그아웃</button>
      </div>}
    </section>
  )
}

export default App
