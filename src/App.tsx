import { useCallback } from 'react'
import { useStore } from './hooks/useStore'
import { useKeyboard } from './hooks/useKeyboard'
import { Header } from './components/Header'
import { NotesList } from './components/NotesList'
import { DocumentView } from './components/DocumentView'
import { ReviewView } from './components/ReviewView'
import { FormatView } from './components/FormatView'
import { QuestionPicker } from './components/QuestionPicker'
import { AnnotationList } from './components/AnnotationList'

export default function App() {
  const { notes, mode, currentNoteIndex, selectedQuestion, addAnnotation } = useStore()

  const currentNote = notes[currentNoteIndex]
  
  const handleTagSelection = useCallback((questionId: string) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    
    const text = sel.toString().trim()
    if (!text) return

    const container = document.getElementById('doc-content')
    if (!container) return

    const range = sel.getRangeAt(0)
    const preRange = document.createRange()
    preRange.selectNodeContents(container)
    preRange.setEnd(range.startContainer, range.startOffset)
    
    const start = preRange.toString().length
    const end = start + text.length

    if (currentNote) {
      addAnnotation({
        noteId: currentNote.id,
        start,
        end,
        text,
        questions: [questionId]
      })
      sel.removeAllRanges()
    }
  }, [currentNote, addAnnotation])

  const handleCreateAnnotation = useCallback((text: string, start: number, end: number) => {
    if (!currentNote) return
    
    if (selectedQuestion) {
      addAnnotation({
        noteId: currentNote.id,
        start,
        end,
        text,
        questions: [selectedQuestion]
      })
    }
  }, [currentNote, selectedQuestion, addAnnotation])

  useKeyboard(handleTagSelection)

  return (
    <div className="h-screen flex flex-col bg-maple-50">
      <Header />
      
      <div className="flex-1 flex min-h-0">
        {mode === 'annotate' && (
          <>
            <NotesList />
            <DocumentView onCreateAnnotation={handleCreateAnnotation} />
            <aside className="w-64 bg-white border-l border-maple-200 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <QuestionPicker onSelect={handleTagSelection} />
                {currentNote && <AnnotationList noteId={currentNote.id} />}
              </div>
            </aside>
          </>
        )}
        
        {mode === 'review' && <ReviewView />}
        
        {mode === 'format' && <FormatView />}
      </div>
    </div>
  )
}
