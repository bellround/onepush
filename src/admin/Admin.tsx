import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { appPath, apiUrl } from '../platform'
import './admin.css'

type Round = {
  id: string
  session_id: string
  username: string | null
  chapter: string
  round: number
  level_id: string
  level_index: number
  cleared: boolean
  clear_ms: number | null
  quit_ms: number | null
  advanced_after_clear: boolean
  reset_count: number
  undo_count: number
  first_move_ms: number | null
  max_gap_ms: number | null
  actions: unknown[]
  created_at: string
}

type Page = { rows: Round[]; nextBeforeId: string | null; hasMore: boolean }
type Cursor = string | null
const labels: Record<keyof Omit<Round, 'actions'>, string> = {
  id: '기록 ID', session_id: '세션 ID', username: '아이디', chapter: '챕터', round: '라운드',
  level_id: '레벨 ID', level_index: '레벨 인덱스', cleared: '클리어 여부',
  clear_ms: '클리어 시간 (ms)', quit_ms: '종료 시간 (ms)',
  advanced_after_clear: '클리어 후 다음 진행', reset_count: '초기화 횟수',
  undo_count: '되돌리기 횟수', first_move_ms: '첫 이동 시간 (ms)',
  max_gap_ms: '최대 행동 간격 (ms)', created_at: '생성 시각 (ISO)',
}

function RecordDetails({ row }: { row: Round }) {
  const [showActions, setShowActions] = useState(false)
  return (
    <details className="admin-record">
      <summary>
        <span className="admin-record-id">#{row.id}</span>
        <span className="admin-record-level"><strong>{row.chapter} / {row.level_id}</strong><span>{row.username ?? '익명'} · 라운드 {row.round} · 레벨 인덱스 {row.level_index}</span></span>
        <span className={`admin-badge${row.cleared ? ' admin-badge-clear' : ''}`}>{row.cleared ? '클리어' : '미클리어'}</span>
        <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('ko-KR')}</time>
        <span className="admin-expand">상세 보기</span>
      </summary>
      <div className="admin-record-body">
        <dl className="admin-fields">
          {Object.entries(labels).map(([key, label]) => {
            const value = key === 'username' ? row.username ?? '익명' : row[key as keyof typeof labels]
            return <div key={key}><dt>{label}<span>{key}</span></dt><dd>{value === null ? 'null (기록 없음)' : typeof value === 'boolean' ? `${value ? '예' : '아니요'} (${value})` : String(value)}</dd></div>
          })}
        </dl>
        <details className="admin-actions" onToggle={event => setShowActions(event.currentTarget.open)}>
          <summary>행동 기록 JSON · {row.actions.length}개 <span>actions · 보드 데이터 포함</span></summary>
          {showActions && <pre tabIndex={0} aria-label={`기록 ${row.id} 전체 행동 JSON`}>{JSON.stringify(row.actions, null, 2)}</pre>}
        </details>
      </div>
    </details>
  )
}

export default function Admin() {
  const [auth, setAuth] = useState<'login' | 'ready'>('login')
  const [password, setPassword] = useState('')
  const [page, setPage] = useState<Page | null>(null)
  const [cursors, setCursors] = useState<Cursor[]>([null])
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const exportRequest = useRef<AbortController | null>(null)
  const authenticated = useRef(false)
  const token = useRef<string | null>(null)
  const retryCursors = useRef<Cursor[]>([null])

  const startRequest = () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    return controller
  }

  const requireLogin = useCallback((message: string) => {
    request.current?.abort()
    exportRequest.current?.abort()
    exportRequest.current = null
    setBusy(false)
    setExporting(false)
    setExportError('')
    authenticated.current = false
    token.current = null
    setAuth('login')
    setPage(null)
    setCursors([null])
    setUpdatedAt(null)
    setPassword('')
    setNotice(message)
  }, [])

  const load = useCallback(async (target: Cursor[]) => {
    const controller = startRequest()
    retryCursors.current = target
    const params = new URLSearchParams({ limit: '50' })
    const before = target[target.length - 1]
    if (before !== null) params.set('beforeId', before)
    try {
      const response = await fetch(apiUrl(`/admin/rounds?${params}`), {
        credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${token.current ?? ''}` },
      })
      if (controller.signal.aborted) return
      if (response.status === 401) {
        requireLogin(authenticated.current ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : '')
        return
      }
      if (!response.ok) throw new Error('records')
      const result: Page = await response.json()
      if (controller.signal.aborted) return
      authenticated.current = true
      setAuth('ready')
      setPage(result)
      setCursors(target)
      setNotice('')
      setUpdatedAt(new Date().toLocaleTimeString('ko-KR'))
    } catch {
      if (!controller.signal.aborted) setError('기록을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }, [requireLogin])

  useEffect(() => {
    return () => {
      request.current?.abort()
      exportRequest.current?.abort()
      exportRequest.current = null
      token.current = null
    }
  }, [])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !password) return
    const controller = startRequest()
    setNotice('')
    try {
      const response = await fetch(apiUrl('/admin/login'), {
        method: 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }), signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (response.status === 401) {
        setError('비밀번호가 올바르지 않습니다. 다시 입력해 주세요.')
        return
      }
      if (response.status !== 200) throw new Error('login')
      const result: { token: string } = await response.json()
      if (controller.signal.aborted) return
      if (!/^[a-f0-9]{64}$/.test(result.token)) throw new Error('login')
      token.current = result.token
      setPassword('')
      authenticated.current = true
      setAuth('ready')
      void load([null])
    } catch {
      if (!controller.signal.aborted) setError('로그인하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  async function logout() {
    exportRequest.current?.abort()
    exportRequest.current = null
    setExporting(false)
    setExportError('')
    const controller = startRequest()
    try {
      const response = await fetch(apiUrl('/admin/logout'), {
        method: 'POST', credentials: 'omit', signal: controller.signal,
        headers: { Authorization: `Bearer ${token.current ?? ''}` },
      })
      if (controller.signal.aborted) return
      if (response.status !== 204 && response.status !== 401) throw new Error('logout')
      requireLogin('로그아웃되었습니다.')
    } catch {
      if (!controller.signal.aborted) setError('로그아웃하지 못했습니다. 다시 로그아웃해 주세요.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  async function downloadExport() {
    if (exportRequest.current || busy || !authenticated.current) return
    const controller = new AbortController()
    exportRequest.current = controller
    setExporting(true)
    setExportError('')
    try {
      const response = await fetch(apiUrl('/admin/export'), {
        credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${token.current ?? ''}` },
      })
      if (controller.signal.aborted) return
      if (response.status === 401) {
        requireLogin('로그인이 만료되었습니다. 다시 로그인해 주세요.')
        return
      }
      if (!response.ok) throw new Error('export')
      const blob = await response.blob()
      if (controller.signal.aborted) return
      const filename = response.headers.get('Content-Disposition')?.match(/filename="?(ion-puzzle-db-\d{4}-\d{2}-\d{2}\.json)"?(?:;|$)/i)?.[1]
        ?? `ion-puzzle-db-${new Date().toISOString().slice(0, 10)}.json`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      try {
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
      } finally {
        link.remove()
        // Give the browser time to start reading the download before releasing it.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch {
      if (!controller.signal.aborted) setExportError('전체 데이터를 다운로드하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.')
    } finally {
      if (exportRequest.current === controller) {
        exportRequest.current = null
        setExporting(false)
      }
    }
  }

  return (
    <main className="ion-admin">
      <header className="admin-header">
        <a className="admin-brand" href={appPath('/')}><span aria-hidden="true" className="admin-atom">i⁺</span>이온 퍼즐</a>
        <span className="admin-readonly">관리자 · 읽기 전용</span>
      </header>
      <section className="admin-heading">
        <p className="admin-eyebrow">PLAY RECORDS</p>
        <h1>게임 기록</h1>
        <p>저장된 모든 플레이 기록과 행동 데이터를 확인합니다.<br />기록은 이 화면에서 수정하거나 삭제할 수 없습니다.</p>
      </section>

      {auth === 'login' ? (
        <section className="admin-login" aria-labelledby="admin-login-title">
          <h2 id="admin-login-title">관리자 로그인</h2>
          <p>기록을 확인하려면 관리자 비밀번호를 입력해 주세요.</p>
          {notice && <p className="admin-notice" role="status">{notice}</p>}
          <form onSubmit={login} aria-busy={busy}>
            <label htmlFor="admin-password">비밀번호</label>
            <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required aria-describedby={error ? 'admin-login-error' : undefined} />
            {error && <p id="admin-login-error" className="admin-error" role="alert">{error}</p>}
            <button className="admin-primary" disabled={busy || !password} type="submit">{busy ? '로그인 중…' : '로그인'}</button>
          </form>
        </section>
      ) : (
        <section className="admin-data" aria-label="저장된 게임 기록">
          <div className="admin-toolbar">
            <div><h2>전체 기록</h2><p>페이지당 최대 50개{updatedAt && ` · ${updatedAt} 조회`}</p></div>
            <div className="admin-controls">
              <button onClick={() => void load([null])} disabled={busy}>새로고침</button>
              <button onClick={() => void downloadExport()} disabled={busy || exporting} aria-busy={exporting}>{exporting ? '다운로드 준비 중…' : '전체 DB 다운로드'}</button>
              {auth === 'ready' && <button onClick={() => void logout()} disabled={busy}>로그아웃</button>}
            </div>
          </div>
          {exportError && <p className="admin-error" role="alert">{exportError}</p>}
          {error && <div className="admin-error" role="alert"><p>{error}</p>{page && <p>아래는 마지막으로 불러온 기록입니다.</p>}<button onClick={() => void load(retryCursors.current)} disabled={busy}>기록 다시 불러오기</button></div>}
          <p className="admin-status" role="status">{exporting ? '전체 데이터를 JSON 파일로 다운로드하는 중…' : busy ? '기록을 불러오는 중…' : page ? `${cursors.length}페이지 · ${page.rows.length}개 기록` : '기록을 아직 불러오지 못했습니다.'}</p>
          <div aria-busy={busy}>
            {page?.rows.length === 0 && <div className="admin-empty"><h2>표시할 기록이 없습니다</h2><p>{cursors.length > 1 ? '이 페이지에 남은 기록이 없습니다. 이전 페이지로 돌아가거나 새로고침해 주세요.' : '저장된 플레이 기록이 아직 없습니다. 나중에 새로고침해 주세요.'}</p></div>}
            <div className="admin-records" key={cursors.join(':') + updatedAt}>
              {page?.rows.map(row => <RecordDetails row={row} key={row.id} />)}
            </div>
          </div>
          {page && <nav className="admin-pagination" aria-label="기록 페이지">
            <button disabled={busy || cursors.length === 1} onClick={() => void load(cursors.slice(0, -1))}>이전</button>
            <span>{cursors.length}페이지</span>
            <button disabled={busy || !page.hasMore || page.nextBeforeId === null} onClick={() => void load([...cursors, page.nextBeforeId])}>다음</button>
            <p>{page.hasMore ? '다음 페이지에서 기록을 더 확인할 수 있습니다.' : '마지막 페이지입니다.'}</p>
          </nav>}
        </section>
      )}
    </main>
  )
}
