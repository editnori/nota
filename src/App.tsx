import { useCallback, useEffect, useState, useRef } from 'react'
import { useStore } from './hooks/useStore'
import { useKeyboard } from './hooks/useKeyboard'
import { Header } from './components/Header'
import { NotesList } from './components/NotesList'
import { DocumentView } from './components/DocumentView'
import { ReviewView } from './components/ReviewView'
import { FormatView } from './components/FormatView'
import { QuestionPicker } from './components/QuestionPicker'
import { AnnotationList } from './components/AnnotationList'
import { importFromDrop, handleImportWithProgress } from './lib/importers'
import { Loader2, Upload } from 'lucide-react'

export default function App() {
  const { 
    notes, mode, currentNoteIndex, selectedQuestion, addAnnotation, 
    isLoaded, darkMode, isImporting, importProgress, setImporting 
  } = useStore()
  const [isDragging, setIsDragging] = useState(false)
  const dragCountRef = useRef(0)

  const currentNote = notes[currentNoteIndex]
  
  // Apply dark mode to document - always sync with state
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    if (darkMode) {
      document.documentElement.classList.add('dark')
    }
  }, [darkMode])

  // Handle drag-drop import - uses shared import handler
  const handleDropImport = useCallback(async (dataTransfer: DataTransfer) => {
    if (!dataTransfer.items || dataTransfer.items.length === 0) return
    
    await handleImportWithProgress(() => 
      importFromDrop(dataTransfer, (progress) => {
        if (progress.phase === 'scanning') {
          setImporting(true, 'Scanning...')
        } else if (progress.phase === 'processing') {
          setImporting(true, `${progress.current} / ${progress.total}`)
        } else if (progress.phase === 'done') {
          setImporting(true, `${progress.current} notes`)
        }
      })
    )
  }, [setImporting])

  // Use window-level drag events for reliable capture
  // Only active when NOT in format mode (FormatView has its own handler)
  useEffect(() => {
    // Skip window-level drag handling in format mode
    if (mode === 'format') {
      setIsDragging(false)
      dragCountRef.current = 0
      return
    }
    
    function onDragEnter(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      dragCountRef.current++
      if (dragCountRef.current === 1) {
        setIsDragging(true)
      }
    }
    
    function onDragOver(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      // Required to allow drop
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }
    
    function onDragLeave(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      dragCountRef.current--
      if (dragCountRef.current <= 0) {
        dragCountRef.current = 0
        setIsDragging(false)
      }
    }
    
    async function onDrop(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      dragCountRef.current = 0
      setIsDragging(false)
      
      // Process the dropped files
      if (e.dataTransfer) {
        handleDropImport(e.dataTransfer)
      }
    }
    
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleDropImport, mode])
  
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
        questions: [questionId],
        source: 'manual'
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
        questions: [selectedQuestion],
        source: 'manual'
      })
    }
  }, [currentNote, selectedQuestion, addAnnotation])

  useKeyboard(handleTagSelection)

  // Show loading while session is being restored
  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-maple-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-maple-300 border-t-maple-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-maple-500">Loading session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-maple-50 dark:bg-maple-900 relative">
      <Header />
      
      <div className="flex-1 flex min-h-0">
        {mode === 'annotate' && (
          <>
            <NotesList />
            <DocumentView onCreateAnnotation={handleCreateAnnotation} />
            <aside className="w-64 bg-white dark:bg-maple-800 border-l border-maple-200 dark:border-maple-700 flex flex-col overflow-hidden">
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

      {/* Drag overlay - more visible indicator */}
      {isDragging && (
        <div className="fixed inset-0 bg-maple-600/30 dark:bg-maple-400/30 backdrop-blur-sm flex items-center justify-center z-[60] pointer-events-none">
          <div className="border-4 border-dashed border-maple-600 dark:border-maple-400 rounded-2xl p-12 m-8 bg-maple-100/90 dark:bg-maple-800/90 shadow-2xl text-center animate-pulse">
            <div className="bg-maple-600 dark:bg-maple-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-10 h-10 text-white" />
            </div>
            <p className="text-xl font-semibold text-maple-800 dark:text-maple-100">Drop files or folders here</p>
            <p className="text-sm text-maple-600 dark:text-maple-300 mt-2">Supports: TXT, JSON, JSONL</p>
          </div>
        </div>
      )}

      {/* Global import progress overlay */}
      {isImporting && (
        <div className="absolute inset-0 bg-maple-900/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-maple-800 rounded-xl p-6 shadow-lg text-center min-w-[250px]">
            <Loader2 className="w-8 h-8 animate-spin text-maple-600 dark:text-maple-300 mx-auto mb-3" />
            <p className="text-sm text-maple-600 dark:text-maple-300">{importProgress}</p>
          </div>
        </div>
      )}
    </div>
  )
}
