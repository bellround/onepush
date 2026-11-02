import type { Board } from './types.ts'

// 효과음을 한곳에서 관리합니다 — color.css 가 색을 모아 두는 것과 같은 역할입니다.
// 음원 파일 없이 Web Audio 로 그때그때 합성하므로, 아래 표의 숫자만 바꾸면 소리가 바뀝니다.

export type SfxName = 'move' | 'blocked' | 'bond' | 'bondUp' | 'undo' | 'reset' | 'clear'

// freq: 시작 음 높이(Hz) — 숫자가 크면 높은 소리
// to: 적어 두면 freq 에서 이 높이까지 미끄러집니다(없으면 한 음으로 고정)
// dur: 길이(초)
// wave: 파형 — sine 둥글게 / triangle 또렷하게 / square 전자음 / sawtooth 거칠게
// gain: 음량(0~1)
interface Tone {
  freq: number
  to?: number
  dur: number
  wave: OscillatorType
  gain: number
}

// 소리마다 음을 차례로 이어 냅니다. 대부분은 한 음이고, 클리어만 세 음입니다.
export const SOUNDS: Record<SfxName, Tone[]> = {
  move: [{ freq: 220, dur: 0.05, wave: 'triangle', gain: 0.18 }], // 한 칸 이동 — 짧고 낮게
  blocked: [{ freq: 150, to: 55, dur: 0.07, wave: 'sine', gain: 0.3 }], // 벽·보드 끝에 막힘 — 짧게 "툭"
  bond: [{ freq: 440, to: 660, dur: 0.12, wave: 'sine', gain: 0.22 }], // 결합선 생성 — 올라가는 음
  bondUp: [{ freq: 660, to: 990, dur: 0.14, wave: 'sine', gain: 0.22 }], // + 표시 통과로 차수 증가 — 더 높게
  undo: [{ freq: 330, to: 220, dur: 0.1, wave: 'triangle', gain: 0.16 }], // 되돌리기 — 내려가는 음
  reset: [{ freq: 300, to: 150, dur: 0.22, wave: 'triangle', gain: 0.16 }], // 리셋 — 길게 내려가는 음
  clear: [
    // 클리어 — 도·미·솔 올라가는 아르페지오
    { freq: 523, dur: 0.12, wave: 'sine', gain: 0.22 },
    { freq: 659, dur: 0.12, wave: 'sine', gain: 0.22 },
    { freq: 784, dur: 0.3, wave: 'sine', gain: 0.22 },
  ],
}

// 키를 누르고 있으면 keydown 이 초당 수십 번 들어옵니다. 같은 소리를 이 간격(초) 안에
// 다시 내지 않아, 벽에 계속 박을 때 "따다다닥" 하고 뭉개지는 것을 막습니다.
// 숫자를 줄이면 더 자주 울리고, 적어 두지 않은 소리는 제한 없이 울립니다.
const MIN_GAP: Partial<Record<SfxName, number>> = {
  blocked: 0.18, // 막힘 소리만 제한 — 이동음은 한 칸 갈 때마다 그대로 들려야 한다
}

// 마지막으로 낸 시각(초)과 비교해, 간격이 덜 찼으면 이번 소리는 건너뜁니다.
export function allowPlay(name: SfxName, now: number, lastAt: Map<SfxName, number>): boolean {
  const gap = MIN_GAP[name]
  const last = lastAt.get(name)
  if (gap !== undefined && last !== undefined && now - last < gap) return false
  lastAt.set(name, now)
  return true
}

const STORAGE_KEY = 'sfx-muted'

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean): void {
  muted = next
  try {
    localStorage.setItem(STORAGE_KEY, String(next))
  } catch {
    // 저장이 차단되어도 이번 판에서는 음소거가 그대로 적용된다.
  }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

let muted = loadMuted()
let context: AudioContext | null = null
const lastPlayedAt = new Map<SfxName, number>()

export function play(name: SfxName): void {
  if (muted) return
  // 자동재생 정책 때문에 사용자 입력 안에서 처음 만들어야 소리가 난다.
  const ctx = (context ??= new AudioContext())
  if (ctx.state === 'suspended') void ctx.resume()
  if (!allowPlay(name, ctx.currentTime, lastPlayedAt)) return

  let at = ctx.currentTime
  for (const tone of SOUNDS[name]) {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = tone.wave
    osc.frequency.setValueAtTime(tone.freq, at)
    if (tone.to !== undefined) osc.frequency.linearRampToValueAtTime(tone.to, at + tone.dur)
    // 끝에서 음량을 0 가까이 내려야 뚝 끊기는 잡음이 안 생긴다.
    amp.gain.setValueAtTime(tone.gain, at)
    amp.gain.exponentialRampToValueAtTime(0.0001, at + tone.dur)
    osc.connect(amp).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + tone.dur)
    at += tone.dur
  }
}

function orderSum(board: Board): number {
  return board.bonds.reduce((sum, bond) => sum + bond.order, 0)
}

// 이동 키를 눌렀을 때 어떤 소리를 낼지 — 사건 판정도 여기 모아 둡니다.
// pushTile()은 아무 일도 못 하면 받은 보드를 그대로 돌려줍니다(=막힘).
export function moveSound(before: Board, after: Board): SfxName {
  if (after === before) return 'blocked'
  if (after.bonds.length > before.bonds.length) return 'bond'
  if (orderSum(after) > orderSum(before)) return 'bondUp'
  return 'move'
}
