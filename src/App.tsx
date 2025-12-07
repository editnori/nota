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
import { ImportModeModal } from './components/ImportModeModal'
import { importFromDrop, importFiles, handleImportWithProgress, formatTextWithMode } from './lib/importers'
import { setBulkOperation } from './hooks/useStore'
import { Loader2, Upload } from 'lucide-react'
import type { Note, FormatterMode } from './lib/types'
import { ErrorBoundary } from './components/ErrorBoundary'

// Check if running in Tauri desktop app
function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

function AppContent() {
  const { 
    notes, mode, currentNoteIndex, selectedQuestion, addAnnotation, 
    isLoaded, isTransitioning, darkMode, isImporting, importProgress, setImporting,
    pendingImport, setPendingImport
  } = useStore()
  const [isDragging, setIsDragging] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const [pendingFileCount, setPendingFileCount] = useState(0)
  const dragCountRef = useRef(0)

  const currentNote = notes[currentNoteIndex]
  
  // Apply dark mode to document - always sync with state
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    if (darkMode) {
      document.documentElement.classList.add('dark')
    }
  }, [darkMode])

  // Show error toast with auto-dismiss - defined early so other callbacks can use it
  const showDropError = useCallback((msg: string) => {
    setDropError(msg)
    setTimeout(() => setDropError(null), 3000)
  }, [])

  // Handle drag-drop import - extracts files immediately (DataTransfer becomes stale after event)
  const handleDropImport = useCallback(async (dataTransfer: DataTransfer) => {
    const files: File[] = []
    
    // Try webkitGetAsEntry first (supports folders)
    const entries: FileSystemEntry[] = []
    if (dataTransfer.items && dataTransfer.items.length > 0) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i]
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry()
          if (entry) entries.push(entry)
        }
      }
    }
    
    // Collect files from entries (including from folders)
    if (entries.length > 0) {
      async function collectFiles(entry: FileSystemEntry): Promise<void> {
        if (entry.isFile) {
          try {
            const file = await new Promise<File>((resolve, reject) => {
              (entry as FileSystemFileEntry).file(resolve, reject)
            })
            if (file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.jsonl')) {
              files.push(file)
            }
          } catch (err) {
            console.warn('Failed to get file from entry:', entry.name, err)
          }
        } else if (entry.isDirectory) {
          const dir = entry as FileSystemDirectoryEntry
          const reader = dir.createReader()
          let batch: FileSystemEntry[]
          do {
            batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
              reader.readEntries(resolve, reject)
            })
            for (const sub of batch) {
              await collectFiles(sub)
            }
          } while (batch.length > 0)
        }
      }
      
      for (const entry of entries) {
        await collectFiles(entry)
      }
    }
    
    // Fallback to dataTransfer.files if no entries
    if (files.length === 0 && dataTransfer.files && dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i]
        if (file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.jsonl')) {
          files.push(file)
        }
      }
    }
    
    if (files.length === 0) {
      showDropError('No valid files found (use .txt, .json, or .jsonl)')
      return
    }
    
    setPendingFileCount(files.length)
    setPendingImport({ type: 'files', data: files })
  }, [setPendingImport, showDropError])

  // Process import with selected mode
  const processImportWithMode = useCallback(async (mode: FormatterMode) => {
    if (!pendingImport) return
    
    setPendingImport(null)
    
    if (pendingImport.type === 'files') {
      // Files were already extracted from DataTransfer
      await handleImportWithProgress(() => 
        importFiles(pendingImport.data, (progress) => {
          if (progress.phase === 'scanning') {
            setImporting(true, 'Scanning...')
          } else if (progress.phase === 'processing') {
            setImporting(true, `${progress.current} / ${progress.total}`)
          } else if (progress.phase === 'done') {
            setImporting(true, `${progress.current} notes`)
          }
        }, mode)
      )
    } else if (pendingImport.type === 'drop') {
      // Legacy: DataTransfer (might be stale, but kept for compatibility)
      await handleImportWithProgress(() => 
        importFromDrop(pendingImport.data, (progress) => {
          if (progress.phase === 'scanning') {
            setImporting(true, 'Scanning...')
          } else if (progress.phase === 'processing') {
            setImporting(true, `${progress.current} / ${progress.total}`)
          } else if (progress.phase === 'done') {
            setImporting(true, `${progress.current} notes`)
          }
        }, mode)
      )
    } else if (pendingImport.type === 'tauri') {
      // Handle Tauri drop with mode
      await handleTauriDropWithMode(pendingImport.data, mode)
    }
  }, [pendingImport, setPendingImport, setImporting])

  // Handle Tauri file drop - shows mode modal first
  const handleTauriDrop = useCallback((paths: string[]) => {
    if (paths.length === 0) return
    setPendingFileCount(paths.length)
    setPendingImport({ type: 'tauri', data: paths })
  }, [setPendingImport])

  // Process Tauri drop with selected mode
  const handleTauriDropWithMode = useCallback(async (paths: string[], mode: FormatterMode) => {
    setImporting(true, 'Reading files...')
    setBulkOperation(true)
    
    const getFileName = (p: string) => {
      const parts = p.replace(/\\/g, '/').split('/')
      return parts[parts.length - 1] || 'note'
    }
    
    const hasExt = (name: string, ext: string) => 
      name.toLowerCase().endsWith(ext.toLowerCase())
    
    let errorMsg = ''
    let unsupportedFiles: string[] = []
    
    try {
      const { readTextFile, stat, readDir } = await import('@tauri-apps/plugin-fs')
      const importedNotes: Note[] = []
      
      for (const filePath of paths) {
        try {
          const info = await stat(filePath)
          
          if (info.isDirectory) {
            setImporting(true, `Scanning folder...`)
            const entries = await readDir(filePath)
            const txtFiles = entries.filter(e => e.name && hasExt(e.name, '.txt'))
            
            for (let i = 0; i < txtFiles.length; i++) {
              const entry = txtFiles[i]
              const entryName = entry.name || ''
              setImporting(true, `Processing ${i + 1}/${txtFiles.length}`)
              
              const sep = filePath.includes('\\') ? '\\' : '/'
              const fullPath = `${filePath}${sep}${entryName}`
              const content = await readTextFile(fullPath)
              const formattedText = await formatTextWithMode(content, mode)
              importedNotes.push({
                id: entryName.replace(/\.txt$/i, ''),
                text: formattedText,
                meta: { source: entryName, rawText: content }
              })
            }
            
            if (txtFiles.length === 0) {
              unsupportedFiles.push(`${getFileName(filePath)}/ (no .txt files)`)
            }
          } else {
            const fileName = getFileName(filePath)
            if (hasExt(fileName, '.txt')) {
              setImporting(true, `Reading ${fileName}`)
              const content = await readTextFile(filePath)
              const formattedText = await formatTextWithMode(content, mode)
              importedNotes.push({
                id: fileName.replace(/\.txt$/i, ''),
                text: formattedText,
                meta: { source: fileName, rawText: content }
              })
            } else if (hasExt(fileName, '.json') || hasExt(fileName, '.jsonl')) {
              setImporting(true, `Reading ${fileName}`)
              const content = await readTextFile(filePath)
              try {
                const parsed = hasExt(fileName, '.jsonl')
                  ? content.trim().split('\n').map(line => JSON.parse(line))
                  : JSON.parse(content)
                const items = Array.isArray(parsed) ? parsed : (parsed.notes || [parsed])
                for (const item of items) {
                  const rawItemText = String(item.text || '')
                  const formattedText = await formatTextWithMode(rawItemText, mode)
                  importedNotes.push({
                    id: String(item.id || item.note_id || `note_${Date.now()}_${Math.random().toString(36).slice(2,6)}`),
                    text: formattedText,
                    meta: { source: fileName, type: item.note_type, rawText: rawItemText }
                  })
                }
              } catch (parseErr) {
                console.error('Failed to parse JSON:', parseErr)
                errorMsg = `Invalid JSON in ${fileName}`
              }
            } else {
              unsupportedFiles.push(fileName)
            }
          }
        } catch (err: any) {
          const fileName = getFileName(filePath)
          console.error('Failed to process path:', filePath, err)
          if (err?.message?.includes('permission') || err?.message?.includes('Permission')) {
            errorMsg = `Permission denied: ${fileName}`
          } else if (err?.message?.includes('not found') || err?.message?.includes('No such file')) {
            errorMsg = `File not found: ${fileName}`
          } else {
            errorMsg = `Failed to read: ${fileName}`
          }
        }
      }
      
      if (importedNotes.length > 0) {
        const { notes: currentNotes, addNotes: doAddNotes, setNotes: doSetNotes } = useStore.getState()
        if (currentNotes.length > 0) {
          doAddNotes(importedNotes)
        } else {
          doSetNotes(importedNotes)
        }
        
        setBulkOperation(false)
        setImporting(true, `${importedNotes.length} notes imported`)
        
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              setImporting(false)
              resolve()
            }, 500)
          })
        })
      } else {
        setBulkOperation(false)
        setImporting(false)
        if (errorMsg) {
          showDropError(errorMsg)
        } else if (unsupportedFiles.length > 0) {
          const fileTypes = unsupportedFiles.slice(0, 2).join(', ')
          showDropError(`Unsupported: ${fileTypes}${unsupportedFiles.length > 2 ? '...' : ''}`)
        } else {
          showDropError('No valid files found (use .txt, .json, or .jsonl)')
        }
      }
    } catch (err: any) {
      console.error('Tauri drop error:', err)
      setBulkOperation(false)
      setImporting(false)
      const msg = err?.message?.includes('permission') 
        ? 'Permission denied - try Import button instead'
        : 'Drop failed - try Import button instead'
      showDropError(msg)
    }
  }, [setImporting, showDropError])

  // Tauri-specific drag-drop event handling - global for all modes
  useEffect(() => {
    if (!isTauri()) return
    // Handle drag-drop globally - always auto-import with formatting
    
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
  }, [handleTauriDrop]) // Removed mode - now global for all modes

  // Web-based drag events (fallback for browser) - global for all modes
  useEffect(() => {
    // Skip web events in Tauri (use native events instead)
    if (isTauri()) return
    
    // Handle drag-drop globally - always auto-import with formatting
    
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

  // Show loading while session is being restored or during state transitions
  if (!isLoaded || isTransitioning) {
    return (
      <div className="h-screen flex items-center justify-center bg-maple-50 dark:bg-maple-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-maple-300 border-t-maple-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-maple-500 dark:text-maple-400">
            {isTransitioning ? 'Processing...' : 'Loading session...'}
          </p>
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

      {/* Drop error toast */}
      {dropError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] bg-red-100 dark:bg-red-900/90 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-2 rounded-lg shadow-lg text-sm animate-toast-enter">
          {dropError}
        </div>
      )}

      {/* Import mode selection modal */}
      {pendingImport && (
        <ImportModeModal
          fileCount={
            // Calculate file count from pendingImport data
            pendingImport.type === 'files' ? pendingImport.data.length :
            pendingImport.type === 'tauri' ? pendingImport.data.length :
            pendingFileCount
          }
          onSelect={processImportWithMode}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}
