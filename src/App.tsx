import { useCallback, useEffect, useRef, useState } from 'react'
import Board from './components/Board.tsx'
import LevelSelect from './components/LevelSelect.tsx'
import Settings from './components/Settings.tsx'
import MoleculeDex from './components/MoleculeDex.tsx'
import { AccountError, enterAccount, getAccount, logoutAccount, resetAccountProgress, saveAccountProgress, type PlayerAccount } from './game/account.ts'
import { advanceProgress, loadProgress, resetProgress } from './game/progress.ts'
import { confirmRoundAccount, startRoundDelivery, suspendRoundAccount } from './game/telemetry.ts'
import { LEVELS } from './levels/index.ts'
import './App.css'

type Screen = 'start' | 'account' | 'settings' | 'playing' | 'levels' | 'dex'

// 게스트는 계정이 없으므로 튜토리얼 완료 기록용으로만 쓰는 고정 이름.
const GUEST_USERNAME = 'guest'

function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [account, setAccount] = useState<PlayerAccount | null>(null)
  // 로그인하지 않고 플레이하는 중 — 계정과 동시에 성립하지 않는다(로그인하면 false).
  const [guest, setGuest] = useState(false)
  const [guestProgress, setGuestProgress] = useState(0)
  const progress = account ? account.progress : guest ? guestProgress : 0
  const [busy, setBusy] = useState(true)
  const [restored, setRestored] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const generation = useRef(0)
  const authBusy = useRef(false)
  const saving = useRef(false)
  const [save, setSave] = useState<{ index: number; username: string; status: 'pending' | 'error' | 'saved'; reauthenticate?: boolean } | null>(null)
  // Keep failed progress separate from the visible screen and from other accounts.
  const pendingClears = useRef(new Map<string, number>())
  const saveBlocking = save?.status === 'pending' || !!save?.reauthenticate
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [recoveryError, setRecoveryError] = useState('')
  const [playingIndex, setPlayingIndex] = useState(0)
  // 이번 세션에 방금 깬 레벨 — 레벨 선택 화면을 그 챕터에서 열기 위한 기준.
  const [lastCleared, setLastCleared] = useState<number | null>(null)

  useEffect(startRoundDelivery, [])

  const restore = useCallback(async () => {
    suspendRoundAccount()
    const request = ++generation.current
    setBusy(true)
    setError('')
    try {
      const result = await getAccount()
      if (request !== generation.current) return
      setAccount(result)
      confirmRoundAccount(result?.username ?? null)
      setRestored(true)
    } catch (error) {
      if (request === generation.current) setError(error instanceof Error ? error.message : '계정을 불러오지 못했습니다.')
    } finally {
      if (request === generation.current) setBusy(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const request = generation.current
    getAccount().then(result => {
      if (!active || request !== generation.current) return
      setAccount(result)
      confirmRoundAccount(result?.username ?? null)
      setRestored(true)
    }).catch(error => {
      if (active && request === generation.current) setError(error instanceof Error ? error.message : '계정을 불러오지 못했습니다.')
    }).finally(() => {
      if (active && request === generation.current) setBusy(false)
    })
    return () => { active = false }
  }, [])

  // 게스트 시작은 서버 응답을 기다리지 않는다 — 진행 중인 계정 요청은 버린다.
  function startGuest() {
    suspendRoundAccount()
    generation.current++
    setError('')
    setSave(null)
    setBusy(false)
    setLastCleared(null)
    setGuestProgress(loadProgress())
    setGuest(true)
    setScreen('levels')
  }

  async function enter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (authBusy.current) return
    // 아이디·비밀번호를 비운 채 계속을 누르면 게스트로 플레이한다.
    if (!username.trim() && !password) { startGuest(); return }
    if (!username.trim() || !password) return
    authBusy.current = true
    suspendRoundAccount()
    const request = ++generation.current
    setBusy(true)
    setError('')
    try {
      // 이번에 게스트로 깬 진행도만 서버가 계정 진행도와 합쳐 준다.
      // 게스트 플레이 중이 아니면 보내지 않는다 — 공용 PC에서 앞사람 기록을 물려받지 않게.
      const local = guest ? loadProgress() : 0
      const result = await enterAccount(username.trim(), password, local > 0 ? local : undefined)
      if (request !== generation.current) return
      setAccount(result)
      confirmRoundAccount(result.username)
      setRestored(true)
      // 승계가 끝났으므로 로컬 기록은 지운다 — 공용 PC에서 다음 게스트가 물려받지 않게.
      resetProgress()
      setGuestProgress(0)
      setGuest(false)
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
    if (authBusy.current || saving.current || saveBlocking) return
    authBusy.current = true
    suspendRoundAccount()
    const request = ++generation.current
    setBusy(true)
    setError('')
    try {
      await logoutAccount()
      if (request !== generation.current) return
      setAccount(null)
      confirmRoundAccount(null)
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
    index = Math.max(index, pendingClears.current.get(expectedUsername) ?? index)
    pendingClears.current.set(expectedUsername, index)
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
      if (pendingClears.current.get(expectedUsername) === index) pendingClears.current.delete(expectedUsername)
      setSave({ index, username: expectedUsername, status: 'saved' })
    } catch (error) {
      if (request === generation.current) setSave({ index, username: expectedUsername, status: 'error', reauthenticate: error instanceof AccountError && (error.status === 401 || error.status === 409) })
    } finally {
      saving.current = false
    }
  }, [])

  useEffect(() => {
    if (!account || saveBlocking) return
    const retry = () => {
      const index = pendingClears.current.get(account.username)
      if (index !== undefined && !authBusy.current) void persistClear(index, account.username)
    }
    const timer = window.setTimeout(retry, 5000)
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('online', retry)
      window.removeEventListener('focus', retry)
    }
  }, [account, save, saveBlocking, persistClear])

  // 게스트는 저장 실패가 없다 — 네트워크 없이 로컬에만 기록한다.
  const clearGuest = useCallback((index: number) => {
    setLastCleared(index)
    setGuestProgress(advanceProgress(index))
  }, [])

  // 설정 > 데이터의 진행 상황 초기화 — 로그인 상태에서는 비밀번호를 다시 확인한다.
  const resetData = useCallback(async (password: string) => {
    if (!account) {
      resetProgress()
      setGuestProgress(0)
      setLastCleared(null)
      return
    }
    const request = ++generation.current
    const result = await resetAccountProgress(password)
    if (request !== generation.current) return
    setAccount(result)
    pendingClears.current.delete(account.username)
    setLastCleared(null)
    setSave(null)
  }, [account])

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
      confirmRoundAccount(result.username)
      await persistClear(pending.index, pending.username)
    } catch (error) {
      if (request === generation.current) setRecoveryError(error instanceof Error ? error.message : '다시 로그인하지 못했습니다.')
    } finally {
      authBusy.current = false
      if (request === generation.current) setBusy(false)
    }
  }

  const saveNotice = save?.status === 'error' && save.reauthenticate && (
    <div className="account-save" onKeyDown={event => event.stopPropagation()}>
      <form className="account-form" onSubmit={recover} aria-busy={busy}>
        <label htmlFor="recovery-username">아이디</label>
        <input id="recovery-username" autoComplete="username" value={save.username} readOnly />
        <label htmlFor="recovery-password">비밀번호</label>
        <input id="recovery-password" type="password" autoComplete="current-password" value={recoveryPassword} onChange={event => setRecoveryPassword(event.target.value)} disabled={busy} required />
        {recoveryError && <p role="alert">{recoveryError}</p>}
        <button type="submit" className="btn" disabled={busy || !recoveryPassword}>{busy ? '확인 중…' : '다시 로그인'}</button>
      </form>
    </div>
  )

  // 아이디·비밀번호가 모두 비어 있으면 계속 버튼이 게스트 진입이 된다.
  const guestEntry = !username.trim() && !password

  if (screen === 'account') {
    return <section className="menu">
      <div>
        <h1>게임 시작</h1>
        <small className="account-entry-hint">처음이면 자동으로 가입됩니다</small>
      </div>
      <form className="account-form" onSubmit={enter} aria-busy={busy}>
        <label htmlFor="player-username">아이디</label>
        <input id="player-username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event => setUsername(event.target.value)} disabled={busy} autoFocus />
        <label htmlFor="player-password">비밀번호</label>
        <input id="player-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
        {error && <p role="alert">{error}</p>}
        {/* 둘 다 비어 있으면 게스트 진입이라 서버 응답을 기다리지 않는다. */}
        <button className="btn" type="submit" disabled={guestEntry ? false : busy || !username.trim() || !password}>{guestEntry ? '게스트로' : busy ? '확인 중…' : '계속'}</button>
      </form>
      <button className="btn" type="button" disabled={busy} onClick={() => { setPassword(''); setError(''); setScreen('start') }}>뒤로</button>
    </section>
  }

  if (screen === 'settings') {
    return (
      <Settings
        onBack={() => { if (!authBusy.current) setScreen('start') }}
        resetMode={account ? 'account' : guest ? 'guest' : null}
        onReset={resetData}
      />
    )
  }

  if (screen === 'dex') {
    return <MoleculeDex progress={progress} onBack={() => setScreen('start')} />
  }

  if (screen === 'levels' && (account || guest)) {
    return (
      <>
      {saveNotice}
      <LevelSelect
        progress={progress}
        focusLevel={lastCleared ?? Math.max(progress - 1, 0)}
        onSelect={(i) => {
          if (authBusy.current || saving.current || saveBlocking || i > progress) return
          setPlayingIndex(i)
          setScreen('playing')
        }}
        onBack={() => { if (!authBusy.current) setScreen('start') }}
      />
      </>
    )
  }

  if (screen === 'playing' && (account || guest)) {
    return (
      <Board
        startLevelIndex={playingIndex}
        username={account ? account.username : GUEST_USERNAME}
        guest={!account}
        accountBusy={account ? busy : false}
        onClear={account ? persistClear : clearGuest}
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
        {/* 계정이 없으면 서버가 응답하지 않아도 눌려야 한다 — 로그인 화면에서 게스트로 들어갈 수 있다. */}
        <button
          type="button"
          className="btn"
          disabled={!!account && (busy || !restored || saveBlocking)}
          onClick={() => { setError(''); setScreen(account || guest ? 'levels' : 'account') }}
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
      {!guest && !restored && !busy && <button type="button" className="btn" onClick={() => void restore()}>계정 다시 불러오기</button>}
      {saveNotice}
      {guest && <div className="account-identity">
        <span>게스트로 플레이 중</span>
        <button type="button" className="btn" onClick={() => { setError(''); setScreen('account') }}>로그인</button>
      </div>}
      {account && <div className="account-identity">
        <span><strong>{account.username}</strong> 님</span>
        <button type="button" className="btn" disabled={busy || saveBlocking} onClick={() => void logout()}>로그아웃</button>
      </div>}
    </section>
  )
}

export default App
