import { useStore, buildAnnotationIndexes, setBulkOperation } from '../hooks/useStore'
import { exportJSON, exportCSV, downloadFile, exportSession, importSession } from '../lib/exporters'
import { Download, Upload, Trash2, Settings, Check, Share2, ChevronDown, Moon, Sun } from 'lucide-react'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { importFiles, handleImportWithProgress, formatNoteText } from '../lib/importers'
import { SettingsModal } from './SettingsModal'
import { ConfirmModal } from './ConfirmModal'
import { loadQuestions } from '../lib/questions'
import type { Note } from '../lib/types'

// Check if running in Tauri desktop app
function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

interface ConfirmState {
  isOpen: boolean
  title: string
  message: string
  confirmText: string
  variant: 'danger' | 'warning' | 'default'
  onConfirm: () => void
}

export function Header() {
  // Use individual selectors to minimize re-renders
  const notes = useStore(s => s.notes)
  const mode = useStore(s => s.mode)
  const setMode = useStore(s => s.setMode)
  const clearSession = useStore(s => s.clearSession)
  const clearNoteAnnotations = useStore(s => s.clearNoteAnnotations)
  const clearAllAnnotations = useStore(s => s.clearAllAnnotations)
  const clearSuggestedAnnotations = useStore(s => s.clearSuggestedAnnotations)
  const currentNoteIndex = useStore(s => s.currentNoteIndex)
  const lastSaved = useStore(s => s.lastSaved)
  const darkMode = useStore(s => s.darkMode)
  const setDarkMode = useStore(s => s.setDarkMode)
  const setImporting = useStore(s => s.setImporting)
  
  // For export and counts, get annotations
  const annotations = useStore(s => s.annotations)
  const annotationsByNote = useStore(s => s.annotationsByNote)
  
  const currentNote = notes[currentNoteIndex]
  
  // Get annotations count for current note - memoized
  const currentNoteAnnotationCount = useMemo(() => {
    if (!currentNote) return 0
    return annotationsByNote.get(currentNote.id)?.length || 0
  }, [currentNote?.id, annotationsByNote])
  
  // Suggested count - derived from indexed map for better performance
  const suggestedCount = useMemo(() => {
    let count = 0
    for (const anns of annotationsByNote.values()) {
      for (const a of anns) {
        if (a.source === 'suggested') count++
      }
    }
    return count
  }, [annotationsByNote])
  
  const [showSettings, setShowSettings] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showImportMenu, setShowImportMenu] = useState(false)
  const [showClearMenu, setShowClearMenu] = useState(false)
  const [saveIndicator, setSaveIndicator] = useState(false)
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'default',
    onConfirm: () => {}
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const sessionInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (lastSaved) {
      setSaveIndicator(true)
      const timer = setTimeout(() => setSaveIndicator(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [lastSaved])

  useEffect(() => {
    function handleClickOutside() {
      setShowExportMenu(false)
      setShowImportMenu(false)
      setShowClearMenu(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Show loading immediately when user clicks import (before file dialog)
  function handleImportClick() {
    setImporting(true, 'Select files...')
  }
  
  // Hide loading if user cancels file dialog
  function handleImportBlur() {
    // Small delay to allow onChange to fire first if files were selected
    setTimeout(() => {
      const files = fileInputRef.current?.files || folderInputRef.current?.files
      if (!files || files.length === 0) {
        setImporting(false)
      }
    }, 300)
  }

  // Native Tauri file open dialog
  const handleTauriImport = useCallback(async (isFolder: boolean) => {
    if (!isTauri()) return false
    
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const { readTextFile, readDir } = await import('@tauri-apps/plugin-fs')
      
      setImporting(true, 'Select files...')
      
      const selected = await open({
        multiple: !isFolder,
        directory: isFolder,
        filters: isFolder ? undefined : [
          { name: 'Supported Files', extensions: ['txt', 'json', 'jsonl'] }
        ],
        title: isFolder ? 'Select Folder' : 'Select Files'
      })
      
      if (!selected) {
        setImporting(false)
        return true // Handled by Tauri (user cancelled)
      }
      
      const paths = Array.isArray(selected) ? selected : [selected]
      const importedNotes: Note[] = []
      
      // Process files
      setImporting(true, 'Processing...')
      setBulkOperation(true) // Prevent rapid saves during import
      
      // Helper to get filename from path (handles both / and \)
      const getFileName = (p: string) => {
        const parts = p.replace(/\\/g, '/').split('/')
        return parts[parts.length - 1] || 'note'
      }
      
      // Helper to check extension (case-insensitive)
      const hasExt = (name: string, ext: string) => 
        name.toLowerCase().endsWith(ext.toLowerCase())
      
      for (const filePath of paths) {
        try {
          if (isFolder) {
            // Read directory contents
            const entries = await readDir(filePath)
            const txtFiles = entries.filter(e => e.name && hasExt(e.name, '.txt'))
            
            for (let i = 0; i < txtFiles.length; i++) {
              const entry = txtFiles[i]
              const entryName = entry.name || ''
              setImporting(true, `Processing ${i + 1}/${txtFiles.length}`)
              const sep = filePath.includes('\\') ? '\\' : '/'
              const fullPath = `${filePath}${sep}${entryName}`
              const content = await readTextFile(fullPath)
              importedNotes.push({
                id: entryName.replace(/\.txt$/i, ''),
                text: formatNoteText(content),
                meta: { source: entryName, rawText: content }
              })
            }
          } else {
            // Read single file
            const fileName = getFileName(filePath)
            setImporting(true, `Reading ${fileName}`)
            
            if (hasExt(fileName, '.txt')) {
              const content = await readTextFile(filePath)
              importedNotes.push({
                id: fileName.replace(/\.txt$/i, ''),
                text: formatNoteText(content),
                meta: { source: fileName, rawText: content }
              })
            } else if (hasExt(fileName, '.json') || hasExt(fileName, '.jsonl')) {
              const content = await readTextFile(filePath)
              try {
                const parsed = hasExt(fileName, '.jsonl')
                  ? content.trim().split('\n').map(line => JSON.parse(line))
                  : JSON.parse(content)
                const items = Array.isArray(parsed) ? parsed : (parsed.notes || [parsed])
                for (const item of items) {
                  const rawItemText = String(item.text || '')
                  importedNotes.push({
                    id: String(item.id || item.note_id || `note_${Date.now()}_${Math.random().toString(36).slice(2,6)}`),
                    text: formatNoteText(rawItemText),
                    meta: { source: fileName, type: item.note_type, rawText: rawItemText }
                  })
                }
              } catch (err) {
                console.error('Failed to parse JSON:', err)
              }
            }
          }
        } catch (err) {
          console.error('Failed to read:', filePath, err)
        }
      }
      
      if (importedNotes.length > 0) {
        const { notes: currentNotes, addNotes, setNotes } = useStore.getState()
        if (currentNotes.length > 0) {
          addNotes(importedNotes)
        } else {
          setNotes(importedNotes)
        }
        
        // Wait for React to process the state update before triggering save
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            setBulkOperation(false) // Re-enable saves, triggers debounced save
            setImporting(true, `${importedNotes.length} notes imported`)
            // Allow UI to fully render before hiding indicator
            setTimeout(() => {
              setImporting(false)
              resolve()
            }, 800)
          })
        })
      } else {
        setBulkOperation(false)
        setImporting(true, 'No valid files found')
        setTimeout(() => setImporting(false), 1000)
      }
      
      return true // Handled by Tauri
    } catch (err) {
      console.error('Tauri import error:', err)
      setBulkOperation(false)
      setImporting(false)
      return false // Fall back to HTML input
    }
  }, [setImporting])

  // Unified import handler for both files and folders - uses shared handler
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) {
      setImporting(false)
      return
    }

    // Small delay to ensure UI updates before heavy processing
    await new Promise(r => setTimeout(r, 50))

    await handleImportWithProgress(() => 
      importFiles(files, (progress) => {
        if (progress.phase === 'scanning') {
          setImporting(true, 'Scanning...')
        } else if (progress.phase === 'processing') {
          setImporting(true, `${progress.current} / ${progress.total}`)
        } else if (progress.phase === 'done') {
          setImporting(true, `${progress.current} notes`)
        }
      })
    )

    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  async function handleSessionImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true, 'Loading session...')
    setBulkOperation(true) // Prevent saves during import

    try {
      const text = await file.text()
      const result = importSession(text)
      
      if (result.notes.length > 0 || result.annotations.length > 0) {
        // Build annotation indexes using shared function
        const indexes = buildAnnotationIndexes(result.annotations)
        
        // Update state in a single batch to avoid partial renders
        useStore.setState({
          notes: result.notes,
          annotations: result.annotations,
          annotationsByNote: indexes.byNote,
          annotationsById: indexes.byId,
          currentNoteIndex: 0,
          filteredNoteIds: null,
          highlightedAnnotation: null
        })
        
        if (result.questions) {
          localStorage.setItem('annotator_questions', JSON.stringify(result.questions))
        }
        
        // Wait for React to process the state update before triggering save
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            setBulkOperation(false) // Re-enable saves
            setImporting(true, `Loaded: ${result.notes.length} notes, ${result.annotations.length} annotations`)
            // Allow UI to fully render before hiding indicator
            setTimeout(() => {
              setImporting(false)
              resolve()
            }, 800)
          })
        })
      } else {
        setBulkOperation(false)
        setImporting(true, 'No data in session file')
        setTimeout(() => setImporting(false), 1500)
      }
    } catch (err) {
      console.error('Session import error:', err)
      setBulkOperation(false)
      setImporting(true, 'Failed to load session')
      setTimeout(() => setImporting(false), 1500)
    }

    if (sessionInputRef.current) {
      sessionInputRef.current.value = ''
    }
  }

  async function handleExportJSON() {
    const content = exportJSON(notes, annotations)
    await downloadFile(content, 'annotations.json', 'application/json')
    setShowExportMenu(false)
  }

  async function handleExportCSV() {
    const content = exportCSV(notes, annotations)
    await downloadFile(content, 'annotations.csv', 'text/csv')
    setShowExportMenu(false)
  }

  async function handleShareSession() {
    const questions = loadQuestions()
    const content = exportSession(notes, annotations, questions)
    const timestamp = new Date().toISOString().slice(0, 10)
    await downloadFile(content, `nota-session-${timestamp}.json`, 'application/json')
    setShowExportMenu(false)
  }

  function handleClearCurrentNote() {
    if (currentNote) {
      clearNoteAnnotations(currentNote.id)
    }
    setShowClearMenu(false)
  }

  function handleClearSuggested() {
    setShowClearMenu(false)
    setConfirmModal({
      isOpen: true,
      title: 'Clear Suggested Annotations',
      message: `This will remove ${suggestedCount} auto-generated annotations.\nManual annotations will be kept.`,
      confirmText: 'Clear Suggested',
      variant: 'warning',
      onConfirm: () => {
        clearSuggestedAnnotations()
        setConfirmModal(m => ({ ...m, isOpen: false }))
      }
    })
  }

  function handleClearAllAnnotations() {
    setShowClearMenu(false)
    setConfirmModal({
      isOpen: true,
      title: 'Clear All Annotations',
      message: `This will remove all ${annotations.length} annotations.\nYour notes will be kept.`,
      confirmText: 'Clear All',
      variant: 'warning',
      onConfirm: () => {
        clearAllAnnotations()
        setConfirmModal(m => ({ ...m, isOpen: false }))
      }
    })
  }

  function handleClearEverything() {
    setShowClearMenu(false)
    setConfirmModal({
      isOpen: true,
      title: 'Clear Everything',
      message: `This will permanently delete:\n• ${notes.length} notes\n• ${annotations.length} annotations\n\nThis cannot be undone.`,
      confirmText: 'Delete Everything',
      variant: 'danger',
      onConfirm: async () => {
        await clearSession()
        setConfirmModal(m => ({ ...m, isOpen: false }))
      }
    })
  }

  return (
    <header className="h-12 bg-white dark:bg-maple-900 border-b border-maple-200 dark:border-maple-700 flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <img src="/favicon.svg" alt="" className="w-5 h-5" />
        <span className="text-sm font-medium text-maple-800 dark:text-maple-100">Nota</span>
      </div>

      <div className="flex items-center gap-0.5 ml-4 bg-maple-100 dark:bg-maple-800 p-0.5 rounded-full">
        <button
          onClick={() => setMode('annotate')}
          className={`px-3 py-1 text-xs rounded-full transition-all ${
            mode === 'annotate'
              ? 'bg-white dark:bg-maple-700 text-maple-800 dark:text-maple-100 shadow-sm'
              : 'text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200'
          }`}
        >
          Annotate
        </button>
        <button
          onClick={() => setMode('review')}
          className={`px-3 py-1 text-xs rounded-full transition-all ${
            mode === 'review'
              ? 'bg-white dark:bg-maple-700 text-maple-800 dark:text-maple-100 shadow-sm'
              : 'text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200'
          }`}
        >
          Review
        </button>
        <button
          onClick={() => setMode('format')}
          className={`px-3 py-1 text-xs rounded-full transition-all ${
            mode === 'format'
              ? 'bg-white dark:bg-maple-700 text-maple-800 dark:text-maple-100 shadow-sm'
              : 'text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200'
          }`}
        >
          Format
        </button>
      </div>

      <div className="flex-1" />

      {saveIndicator && (
        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <Check size={14} />
          <span>Saved</span>
        </div>
      )}

      <input 
        ref={fileInputRef} 
        type="file" 
        multiple 
        accept=".json,.jsonl,.txt" 
        onChange={handleImport} 
        onClick={handleImportClick}
        onBlur={handleImportBlur}
        className="hidden" 
      />
      <input 
        ref={folderInputRef} 
        type="file" 
        // @ts-expect-error webkitdirectory is non-standard but widely supported
        webkitdirectory="" 
        directory="" 
        multiple 
        onChange={handleImport}
        onClick={handleImportClick}
        onBlur={handleImportBlur}
        className="hidden" 
      />
      <input ref={sessionInputRef} type="file" accept=".json" onChange={handleSessionImport} className="hidden" />

      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setShowImportMenu(!showImportMenu); setShowExportMenu(false); setShowClearMenu(false) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 dark:text-maple-300 hover:bg-maple-50 dark:hover:bg-maple-800 rounded-full border border-maple-200 dark:border-maple-600"
        >
          <Upload size={14} />
          Import
        </button>
        {showImportMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded-lg shadow-lg z-50 overflow-hidden min-w-[160px]" onClick={e => e.stopPropagation()}>
            <button
              onClick={async () => { 
                setShowImportMenu(false)
                // Try native Tauri dialog first, fall back to HTML input
                const handled = await handleTauriImport(false)
                if (!handled) {
                  setTimeout(() => fileInputRef.current?.click(), 50)
                }
              }}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50 dark:hover:bg-maple-700 dark:text-maple-200"
            >
              Import Files
            </button>
            <button
              onClick={async () => { 
                setShowImportMenu(false)
                // Try native Tauri dialog first, fall back to HTML input
                const handled = await handleTauriImport(true)
                if (!handled) {
                  setTimeout(() => folderInputRef.current?.click(), 50)
                }
              }}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50 dark:hover:bg-maple-700 dark:text-maple-200"
            >
              Import Folder
            </button>
            <div className="h-px bg-maple-100 dark:bg-maple-700" />
            <button
              onClick={() => { 
                setShowImportMenu(false)
                setTimeout(() => sessionInputRef.current?.click(), 50)
              }}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50 dark:hover:bg-maple-700 text-amber-700 dark:text-amber-400"
            >
              Load Shared Session
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); setShowImportMenu(false); setShowClearMenu(false) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 dark:text-maple-300 hover:bg-maple-50 dark:hover:bg-maple-800 rounded-full border border-maple-200 dark:border-maple-600"
        >
          <Download size={14} />
          Export
        </button>
        {showExportMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded-lg shadow-lg z-50 overflow-hidden min-w-[180px]" onClick={e => e.stopPropagation()}>
            <button
              onClick={handleExportJSON}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50 dark:hover:bg-maple-700 dark:text-maple-200"
            >
              Export Annotations (JSON)
            </button>
            <button
              onClick={handleExportCSV}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50 dark:hover:bg-maple-700 dark:text-maple-200"
            >
              Export Annotations (CSV)
            </button>
            <div className="h-px bg-maple-100 dark:bg-maple-700" />
            <button
              onClick={handleShareSession}
              className="flex items-center gap-2 w-full px-4 py-2 text-xs text-left hover:bg-amber-50 dark:hover:bg-maple-700 text-amber-700 dark:text-amber-400"
            >
              <Share2 size={12} />
              Share Full Session
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setDarkMode(!darkMode)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-maple-500 dark:text-maple-400 hover:bg-maple-50 dark:hover:bg-maple-800 rounded-full"
        title={darkMode ? 'Light mode' : 'Dark mode'}
      >
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <button
        onClick={() => setShowSettings(true)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-maple-500 dark:text-maple-400 hover:bg-maple-50 dark:hover:bg-maple-800 rounded-full"
      >
        <Settings size={16} />
      </button>

      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setShowClearMenu(!showClearMenu); setShowImportMenu(false); setShowExportMenu(false) }}
          className="flex items-center gap-0.5 px-2 py-1.5 text-xs text-maple-400 dark:text-maple-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
        >
          <Trash2 size={14} />
          <ChevronDown size={10} />
        </button>
        {showClearMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded-lg shadow-lg z-50 overflow-hidden min-w-[220px]" onClick={e => e.stopPropagation()}>
            <button
              onClick={handleClearCurrentNote}
              disabled={!currentNote || currentNoteAnnotationCount === 0}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50 dark:hover:bg-maple-700 dark:text-maple-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear this note ({currentNoteAnnotationCount})
            </button>
            {suggestedCount > 0 && (
              <button
                onClick={handleClearSuggested}
                className="block w-full px-4 py-2 text-xs text-left hover:bg-amber-50 dark:hover:bg-maple-700 text-amber-700 dark:text-amber-400"
              >
                Clear suggested only ({suggestedCount})
              </button>
            )}
            <button
              onClick={handleClearAllAnnotations}
              disabled={annotations.length === 0}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50 dark:hover:bg-maple-700 dark:text-maple-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear all annotations ({annotations.length})
            </button>
            <div className="h-px bg-maple-100 dark:bg-maple-700" />
            <button
              onClick={handleClearEverything}
              disabled={notes.length === 0 && annotations.length === 0}
              className="block w-full px-4 py-2 text-xs text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear everything...
            </button>
          </div>
        )}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(m => ({ ...m, isOpen: false }))}
      />
    </header>
  )
}
