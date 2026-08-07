import { useState } from 'react'
import Board from './components/Board.tsx'
import LevelSelect from './components/LevelSelect.tsx'
import Settings from './components/Settings.tsx'
import { loadProgress, saveProgress } from './game/progress.ts'
import './App.css'

type Screen = 'start' | 'settings' | 'playing' | 'levels'

function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [progress, setProgress] = useState(loadProgress)
  const [playingIndex, setPlayingIndex] = useState(0)

  if (screen === 'settings') {
    return (
      <Settings
        onBack={() => setScreen('start')}
        onResetProgress={() => setProgress(0)}
      />
    )
  }

  if (screen === 'levels') {
    return (
      <LevelSelect
        progress={progress}
        onSelect={(i) => {
          setPlayingIndex(i)
          setScreen('playing')
        }}
        onBack={() => setScreen('start')}
      />
    )
  }

  if (screen === 'playing') {
    return (
      <Board
        startLevelIndex={playingIndex}
        onExit={(nextLevelIndex) => {
          const furthest = Math.max(progress, nextLevelIndex)
          setProgress(furthest)
          saveProgress(furthest)
          setScreen('start')
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
          onClick={() => setScreen('levels')}
        >
          게임 시작
        </button>
        <button type="button" className="btn" onClick={() => setScreen('settings')}>
          설정
        </button>
      </div>
    </section>
  )
}

export default App
