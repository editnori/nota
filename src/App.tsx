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
import { importFromDrop, handleImportWithProgress, formatNoteText } from './lib/importers'
import { Loader2, Upload } from 'lucide-react'
import type { Note } from './lib/types'

// Check if running in Tauri desktop app
function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

export default function App() {
  const { 
    notes, mode, currentNoteIndex, selectedQuestion, addAnnotation, 
    isLoaded, darkMode, isImporting, importProgress, setImporting,
    addNotes, setNotes
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

  // Handle drag-drop import - uses shared import handler (for web)
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

  // Handle Tauri file drop - processes file paths directly
  const handleTauriDrop = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return
    
    setImporting(true, 'Processing...')
    
    try {
      const { readTextFile, stat, readDir } = await import('@tauri-apps/plugin-fs')
      const importedNotes: Note[] = []
      
      for (const path of paths) {
        try {
          const info = await stat(path)
          
          if (info.isDirectory) {
            // Read directory contents
            const entries = await readDir(path)
            for (const entry of entries) {
              if (entry.name?.endsWith('.txt')) {
                const fullPath = `${path}/${entry.name}`
                const content = await readTextFile(fullPath)
                importedNotes.push({
                  id: entry.name.replace(/\.txt$/, ''),
                  text: formatNoteText(content),
                  meta: { source: entry.name }
                })
              }
            }
          } else {
            // Single file
            const fileName = path.split('/').pop() || path.split('\\').pop() || 'note'
            if (fileName.endsWith('.txt')) {
              const content = await readTextFile(path)
              importedNotes.push({
                id: fileName.replace(/\.txt$/, ''),
                text: formatNoteText(content),
                meta: { source: fileName }
              })
            } else if (fileName.endsWith('.json') || fileName.endsWith('.jsonl')) {
              const content = await readTextFile(path)
              try {
                const parsed = fileName.endsWith('.jsonl')
                  ? content.trim().split('\n').map(line => JSON.parse(line))
                  : JSON.parse(content)
                const items = Array.isArray(parsed) ? parsed : (parsed.notes || [parsed])
                for (const item of items) {
                  importedNotes.push({
                    id: String(item.id || item.note_id || `note_${Date.now()}_${Math.random().toString(36).slice(2,6)}`),
                    text: formatNoteText(String(item.text || '')),
                    meta: { source: fileName, type: item.note_type }
                  })
                }
              } catch (err) {
                console.error('Failed to parse JSON:', err)
              }
            }
          }
        } catch (err) {
          console.error('Failed to process path:', path, err)
        }
      }
      
      if (importedNotes.length > 0) {
        const currentNotes = useStore.getState().notes
        if (currentNotes.length > 0) {
          addNotes(importedNotes)
        } else {
          setNotes(importedNotes)
        }
        setImporting(true, `${importedNotes.length} notes imported`)
        setTimeout(() => setImporting(false), 500)
      } else {
        setImporting(true, 'No valid files found')
        setTimeout(() => setImporting(false), 800)
      }
    } catch (err) {
      console.error('Tauri drop error:', err)
      setImporting(false)
    }
  }, [setImporting, addNotes, setNotes])

  // Tauri-specific drag-drop event handling
  useEffect(() => {
    if (!isTauri()) return
    if (mode === 'format') return // FormatView handles its own
    
    let unlistenDrop: (() => void) | null = null
    let unlistenEnter: (() => void) | null = null
    let unlistenLeave: (() => void) | null = null
    
    async function setupTauriDragDrop() {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        
        // Listen for drag enter
        unlistenEnter = await listen('tauri://drag-enter', () => {
          setIsDragging(true)
        })
        
        // Listen for drag leave
        unlistenLeave = await listen('tauri://drag-leave', () => {
          setIsDragging(false)
        })
        
        // Listen for file drop
        unlistenDrop = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
          setIsDragging(false)
          if (event.payload?.paths) {
            handleTauriDrop(event.payload.paths)
          }
        })
      } catch (err) {
        console.error('Failed to setup Tauri drag-drop:', err)
      }
    }
    
    setupTauriDragDrop()
    
    return () => {
      unlistenDrop?.()
      unlistenEnter?.()
      unlistenLeave?.()
    }
  }, [mode, handleTauriDrop])

  // Web-based drag events (fallback for browser)
  // Only active when NOT in format mode and NOT in Tauri
  useEffect(() => {
    // Skip in format mode (FormatView has its own handler)
    if (mode === 'format') {
      setIsDragging(false)
      dragCountRef.current = 0
      return
    }
    
    // Skip web events in Tauri (use native events instead)
    if (isTauri()) return
    
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
