import React, { useCallback, useEffect, useState } from 'react'
import { useStore } from './hooks/useStore'
import { useKeyboard } from './hooks/useKeyboard'
import { Header } from './components/Header'
import { NotesList } from './components/NotesList'
import { DocumentView } from './components/DocumentView'
import { ReviewView } from './components/ReviewView'
import { FormatView } from './components/FormatView'
import { QuestionPicker } from './components/QuestionPicker'
import { AnnotationList } from './components/AnnotationList'
import { importFromDrop } from './lib/importers'
import { Loader2, Upload } from 'lucide-react'

export default function App() {
  const { 
    notes, mode, currentNoteIndex, selectedQuestion, addAnnotation, 
    addNotes, setNotes, isLoaded, darkMode, 
    isImporting, importProgress, setImporting 
  } = useStore()
  const [isDragging, setIsDragging] = useState(false)

  const currentNote = notes[currentNoteIndex]
  
  // Apply dark mode to document - always sync with state
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    if (darkMode) {
      document.documentElement.classList.add('dark')
    }
  }, [darkMode])

  // Handle drag-drop folders
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    if (e.dataTransfer.items.length === 0) return
    
    try {
      const imported = await importFromDrop(e.dataTransfer, (progress) => {
        if (progress.phase === 'scanning') {
          setImporting(true, 'Scanning...')
        } else if (progress.phase === 'processing') {
          setImporting(true, `${progress.current} / ${progress.total}`)
        } else if (progress.phase === 'done') {
          setImporting(true, `${progress.current} notes`)
        }
      })
      
      if (imported.length > 0) {
        if (notes.length > 0) {
          addNotes(imported)
        } else {
          setNotes(imported)
        }
        setTimeout(() => setImporting(false), 500)
      } else {
        setImporting(true, 'No valid files found')
        setTimeout(() => setImporting(false), 1000)
      }
    } catch (err) {
      console.error('Import error:', err)
      setImporting(true, 'Import failed')
      setTimeout(() => setImporting(false), 1500)
    }
  }

  // Track drag enter/leave count to handle nested elements
  const dragCountRef = React.useRef(0)

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current++
    if (dragCountRef.current === 1) {
      setIsDragging(true)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current--
    if (dragCountRef.current === 0) {
      setIsDragging(false)
    }
  }
  
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
    <div 
      className="h-screen flex flex-col bg-maple-50 dark:bg-maple-900 relative"
      onDrop={(e) => { dragCountRef.current = 0; handleDrop(e) }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
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

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-maple-600/20 dark:bg-maple-400/20 flex items-center justify-center z-50 pointer-events-none border-4 border-dashed border-maple-500 dark:border-maple-400 m-2 rounded-xl">
          <div className="bg-white dark:bg-maple-800 rounded-xl p-8 shadow-2xl text-center">
            <Upload className="w-12 h-12 text-maple-600 dark:text-maple-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-maple-700 dark:text-maple-200">Drop files or folders here</p>
            <p className="text-sm text-maple-500 dark:text-maple-400 mt-1">TXT, JSON, JSONL files supported</p>
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
