import { useEffect, useState } from 'react'
import { loadKeybindings } from '../game/keybindings.ts'
import { LEVELS } from '../levels/index.ts'

// 레벨 id는 "ch1-1"처럼 챕터 접두어로 시작한다 — 그 접두어로 챕터를 묶는다.
// LEVELS가 파일명 정렬 순서라 같은 챕터 레벨은 항상 연달아 있고, 진행도(progress)는
// 한 번에 한 칸씩만 증가하므로 이전 챕터를 전부 깨야만 다음 챕터 레벨에 도달한다.
function chapterOf(levelId: string): string {
  return levelId.split('-')[0]
}

function chapterLabel(chapterId: string): string {
  const num = chapterId.replace(/^ch/, '')
  return `챕터 ${num}`
}

export default function LevelSelect({
  progress,
  onSelect,
  onBack,
}: {
  progress: number
  onSelect: (levelIndex: number) => void
  onBack: () => void
}) {
  const [bindings] = useState(loadKeybindings)

  const chapters: { id: string; levels: { level: (typeof LEVELS)[number]; index: number }[] }[] = []
  LEVELS.forEach((level, index) => {
    const id = chapterOf(level.id)
    const chapter = chapters.at(-1)
    if (chapter && chapter.id === id) {
      chapter.levels.push({ level, index })
    } else {
      chapters.push({ id, levels: [{ level, index }] })
    }
  })

  const [chapterIndex, setChapterIndex] = useState(() => {
    const found = chapters.findIndex((c) => c.levels.some(({ index }) => index === progress))
    return found === -1 ? 0 : found
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === bindings.exit) {
        e.preventDefault()
        onBack()
        return
      }
      if (e.code === bindings.right) {
        e.preventDefault()
        setChapterIndex((i) => Math.min(i + 1, chapters.length - 1))
        return
      }
      if (e.code === bindings.left) {
        e.preventDefault()
        setChapterIndex((i) => Math.max(i - 1, 0))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindings, chapters.length, onBack])

  const chapter = chapters[chapterIndex]

  return (
    <section className="settings">
      <h1>레벨 선택</h1>
      <div className="level-chapter">
        <h2 className="level-chapter-title">
          {chapterLabel(chapter.id)}
        </h2>
        <div className="level-list">
          {chapter.levels.map(({ level, index }) => {
            const locked = index > progress
            return (
              <button
                key={level.id}
                type="button"
                className="btn level-item"
                disabled={locked}
                onClick={() => onSelect(index)}
              >
                {index + 1}. {level.name}
                {locked ? ' (잠김)' : ''}
              </button>
            )
          })}
        </div>
      </div>
      <div className="chapter-nav">
        <button
          type="button"
          className="btn"
          disabled={chapterIndex === 0}
          onClick={() => setChapterIndex((i) => i - 1)}
        >
          ◀
        </button>
        <button
          type="button"
          className="btn"
          disabled={chapterIndex === chapters.length - 1}
          onClick={() => setChapterIndex((i) => i + 1)}
        >
          ▶
        </button>
      </div>
      <button type="button" className="btn" onClick={onBack}>
        뒤로
      </button>
    </section>
  )
}
