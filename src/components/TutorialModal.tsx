import { useCallback, useEffect, useRef, useState } from 'react'
import { loadKeybindings } from '../game/keybindings.ts'
import { completeTutorial, tutorialStepDelta, tutorialSteps } from '../game/tutorialModal.ts'
import './TutorialModal.css'

export default function TutorialModal({ open, onOpenChange, username }: { open: boolean; onOpenChange: (open: boolean) => void; username: string }) {
  const [step, setStep] = useState(0)
  const [bindings] = useState(loadKeybindings)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const spotlight = useRef<HTMLDivElement>(null)
  const steps = tutorialSteps(bindings)
  const current = steps[step]
  const lastStep = steps.length - 1

  const move = useCallback((delta: number) => {
    if (step + delta > lastStep) {
      completeTutorial(username)
      onOpenChange(false)
    } else {
      setStep(Math.max(0, step + delta))
    }
  }, [step, lastStep, username, onOpenChange])

  useEffect(() => {
    if (!open) return
    // 패널 글자나 비활성 버튼을 눌러 포커스가 대화상자 밖으로 나가도 동작하도록 window에서 받는다.
    function handleKeyDown(e: KeyboardEvent) {
      e.stopPropagation()
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return
      const delta = tutorialStepDelta(e.code)
      if (delta === 0) return
      e.preventDefault()
      if (!e.repeat) move(delta)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, move])

  useEffect(() => {
    if (!open) return
    const node = dialog.current!
    const previousOverflow = document.body.style.overflow
    node.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      node.close()
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    heading.current?.focus({ preventScroll: true })
    const target = document.querySelector<HTMLElement>(`[data-tutorial="${current.target}"]`)
    if (!target) return
    const update = () => {
      const rect = target.getBoundingClientRect()
      Object.assign(spotlight.current!.style, {
        left: `${rect.left - 6}px`, top: `${rect.top - 6}px`,
        width: `${rect.width + 12}px`, height: `${rect.height + 12}px`,
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, step, current.target])

  return (
    <dialog
      ref={dialog}
      className="tutorial-modal"
      aria-labelledby="tutorial-title"
      onCancel={(event) => { event.preventDefault(); onOpenChange(false) }}
    >
      <div ref={spotlight} className="tutorial-spotlight" aria-hidden="true" />
      <div className="tutorial-panel">
      <div className="tutorial-topline">
        <span>게임 방법 · {step + 1} / {steps.length}</span>
        <div className="tutorial-actions">
          <button type="button" className="btn" disabled={step === 0} onClick={() => move(-1)}>이전</button>
          <button type="button" className="btn tutorial-next" onClick={() => move(1)}>{step < lastStep ? '다음' : '알겠어요'}</button>
        </div>
      </div>
      <div className="tutorial-progress" aria-hidden="true">
        {steps.map((item, index) => <span key={item.title} className={index <= step ? 'is-active' : ''} />)}
      </div>
      <h2 id="tutorial-title" ref={heading} tabIndex={-1}>{current.title}</h2>
      <div className="tutorial-copy">
        {current.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      </div>
    </dialog>
  )
}
