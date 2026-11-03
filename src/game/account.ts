import { apiUrl } from '../platform.ts'

export type PlayerAccount = { username: string; progress: number }

export class AccountError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AccountError'
    this.status = status
  }
}

async function request(path: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(apiUrl(path), {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    })
  } catch { throw new AccountError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', 0) }
}

// 서버는 모든 오류에 한국어 { error } 를 담아 보낸다 — 있으면 그 문구가 가장 정확하다.
async function serverMessage(response: Response): Promise<string | null> {
  try {
    const value = await response.json() as { error?: unknown }
    return typeof value.error === 'string' && value.error ? value.error : null
  } catch {
    return null
  }
}

async function check(response: Response): Promise<void> {
  if (response.ok) return
  const messages: Record<number, string> = {
    400: '입력 정보를 확인해 주세요. 아이디는 문자와 숫자만 1~32자, 비밀번호는 4자 이상입니다.',
    401: '이름과 비밀번호를 확인하고 다시 로그인해 주세요.',
    403: '요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.',
    409: '계정 또는 진행 상태가 변경되었습니다. 다시 로그인해 주세요.',
    429: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    503: '서버에 연결할 수 없습니다. 게스트로 시작하면 지금 바로 플레이할 수 있습니다.',
  }
  throw new AccountError(await serverMessage(response) ?? messages[response.status] ?? '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', response.status)
}

async function account(response: Response): Promise<PlayerAccount> {
  await check(response)
  try {
    const value = await response.json() as PlayerAccount
    if (typeof value.username !== 'string' || !Number.isInteger(value.progress) || value.progress < 0) throw new Error()
    return { username: value.username, progress: value.progress }
  } catch { throw new AccountError('서버 응답을 확인할 수 없습니다. 다시 시도해 주세요.', response.status) }
}

// guestProgress 를 보내면 서버가 계정 진행도와 비교해 더 큰 값으로 합쳐 준다.
export async function enterAccount(username: string, password: string, guestProgress?: number): Promise<PlayerAccount> {
  return account(await request('/account/enter', { username, password, ...(guestProgress === undefined ? {} : { guestProgress }) }))
}

export async function resetAccountProgress(password: string): Promise<PlayerAccount> {
  return account(await request('/account/reset', { password }))
}

export async function getAccount(): Promise<PlayerAccount | null> {
  const response = await request('/account')
  return response.status === 401 ? null : account(response)
}

export async function logoutAccount(): Promise<void> {
  await check(await request('/account/logout', {}))
}

export async function saveAccountProgress(levelId: string, expectedUsername: string): Promise<PlayerAccount> {
  return account(await request('/account/progress', { levelId, expectedUsername }))
}
