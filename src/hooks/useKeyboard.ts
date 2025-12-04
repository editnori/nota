import { useEffect } from 'react'
import { useStore } from './useStore'
import { getQuestionByHotkey } from '../lib/questions'

export function useKeyboard(onTagSelection: (questionId: string) => void) {
  const { notes, currentNoteIndex, setCurrentNoteIndex, mode, setMode, setSelectedQuestion } = useStore()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // number keys 1-9, 0 for questions
      if (/^[0-9]$/.test(e.key) && mode === 'annotate') {
        const q = getQuestionByHotkey(e.key)
        if (q) {
          e.preventDefault()
          setSelectedQuestion(q.id)
          onTagSelection(q.id)
        }
        return
      }

      // arrow keys for navigation in annotate mode
      if (e.key === 'ArrowLeft' && mode === 'annotate') {
        e.preventDefault()
        if (currentNoteIndex > 0) {
          setCurrentNoteIndex(currentNoteIndex - 1)
        }
        return
      }

      if (e.key === 'ArrowRight' && mode === 'annotate') {
        e.preventDefault()
        if (currentNoteIndex < notes.length - 1) {
          setCurrentNoteIndex(currentNoteIndex + 1)
        }
        return
      }

      // tab to cycle modes
      if (e.key === 'Tab') {
        e.preventDefault()
        const modes = ['annotate', 'review', 'format'] as const
        const currentIdx = modes.indexOf(mode as typeof modes[number])
        const nextIdx = (currentIdx + 1) % modes.length
        setMode(modes[nextIdx])
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [notes, currentNoteIndex, mode, setCurrentNoteIndex, setMode, setSelectedQuestion, onTagSelection])
}
