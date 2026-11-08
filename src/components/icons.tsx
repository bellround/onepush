// 게임 화면 버튼용 인라인 SVG — currentColor로 그려서 버튼의 색 토큰을 그대로 받는다.
// 버튼 쪽에 aria-label이 붙으므로 아이콘 자체는 접근성 트리에서 숨긴다.
const props = {
  viewBox: '0 0 24 24',
  width: '1em',
  height: '1em',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export function MenuIcon() {
  return (
    <svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function ResetIcon() {
  return (
    <svg {...props}>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v4h-4" />
    </svg>
  )
}

export function UndoIcon() {
  return (
    <svg {...props}>
      <path d="M4 12h10a4.5 4.5 0 0 1 0 9h-6" />
      <path d="M8 8l-4 4 4 4" />
    </svg>
  )
}
