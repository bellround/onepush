import { useEffect, useState } from 'react'

// App.css의 모바일 미디어 쿼리와 같은 기준 — 두 곳이 어긋나지 않게 여기서만 정의한다.
export const MOBILE_QUERY = '(max-width: 768px)'

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return mobile
}
