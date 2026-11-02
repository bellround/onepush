import { useEffect, useRef, useState } from 'react'
import { loadKeybindings } from '../game/keybindings.ts'
import { completeTutorial, tutorialSteps } from '../game/tutorialModal.ts'
import './TutorialModal.css'

export default function TutorialModal({ open, onOpenChange, username }: { open: boolean; onOpenChange: (open: boolean) => void; username: string }) {
  const [step, setStep] = useState(0)
  const [bindings] = useState(loadKeybindings)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const spotlight = useRef<HTMLDivElement>(null)
  const steps = tutorialSteps(bindings)
  const current = steps[step]

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
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div ref={spotlight} className="tutorial-spotlight" aria-hidden="true" />
      <div className="tutorial-panel">
      <div className="tutorial-topline">
        <span>게임 방법 · {step + 1} / {steps.length}</span>
        <div className="tutorial-actions">
          <button type="button" className="btn" onClick={() => onOpenChange(false)}>닫기</button>
          <button type="button" className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>이전</button>
          {step < steps.length - 1 ? (
            <button type="button" className="btn tutorial-next" onClick={() => setStep(step + 1)}>다음</button>
          ) : (
            <button type="button" className="btn tutorial-next" onClick={() => { completeTutorial(username); onOpenChange(false) }}>알겠어요</button>
          )}
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
