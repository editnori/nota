import { useStore } from '../hooks/useStore'
import { exportJSON, exportCSV, downloadFile, exportSession, importSession } from '../lib/exporters'
import { Download, Upload, Trash2, Settings, Check, Share2, ChevronDown, Moon, Sun } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { importJSON, importJSONL, importTXT } from '../lib/importers'
import { SettingsModal } from './SettingsModal'
import { loadQuestions } from '../lib/questions'

export function Header() {
  const { 
    notes, annotations, mode, setMode, setNotes, addNotes, 
    clearSession, clearNoteAnnotations, clearAllAnnotations, clearSuggestedAnnotations,
    currentNoteIndex, lastSaved, darkMode, setDarkMode, setImporting 
  } = useStore()
  const [showSettings, setShowSettings] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showImportMenu, setShowImportMenu] = useState(false)
  const [showClearMenu, setShowClearMenu] = useState(false)
  const [saveIndicator, setSaveIndicator] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const sessionInputRef = useRef<HTMLInputElement>(null)

  const currentNote = notes[currentNoteIndex]
  const currentNoteAnnotationCount = currentNote 
    ? annotations.filter(a => a.noteId === currentNote.id).length 
    : 0
  const suggestedCount = annotations.filter(a => a.source === 'suggested').length

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

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const totalFiles = files.length
    setImporting(true, `Reading ${totalFiles} file(s)...`)

    try {
      let imported: Awaited<ReturnType<typeof importJSON>> = []
      
      if (files.length === 1) {
        const file = files[0]
        setImporting(true, `Processing: ${file.name}`)
        
        if (file.name.endsWith('.json')) {
          imported = await importJSON(file)
        } else if (file.name.endsWith('.jsonl')) {
          imported = await importJSONL(file)
        } else if (file.name.endsWith('.txt')) {
          imported = await importTXT([file])
        }
      } else {
        const txtFiles = Array.from(files).filter(f => f.name.endsWith('.txt'))
        if (txtFiles.length > 0) {
          setImporting(true, `Processing ${txtFiles.length} text files...`)
          imported = await importTXT(txtFiles)
        }
      }

      if (imported.length > 0) {
        setImporting(true, `Formatting ${imported.length} notes...`)
        await new Promise(r => setTimeout(r, 50))
        
        if (notes.length > 0) {
          addNotes(imported)
        } else {
          setNotes(imported)
        }
        
        setImporting(true, `Done! Loaded ${imported.length} notes`)
        setTimeout(() => setImporting(false), 1200)
      } else {
        setImporting(false)
      }
    } catch (err) {
      console.error('Import error:', err)
      setImporting(false)
      alert('Failed to import files')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleFolderImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const totalFiles = files.length
    setImporting(true, `Scanning ${totalFiles} files...`)

    try {
      const filesByFolder = new Map<string, File[]>()
      
      for (const file of Array.from(files)) {
        const path = (file as any).webkitRelativePath || file.name
        const parts = path.split('/')
        const folder = parts.length > 1 ? parts[parts.length - 2] : 'Unknown'
        
        if (!filesByFolder.has(folder)) {
          filesByFolder.set(folder, [])
        }
        filesByFolder.get(folder)!.push(file)
      }

      const imported: Awaited<ReturnType<typeof importTXT>> = []
      let processedFolders = 0
      const totalFolders = filesByFolder.size
      
      for (const [folder, folderFiles] of filesByFolder) {
        const txtFiles = folderFiles.filter(f => f.name.endsWith('.txt'))
        if (txtFiles.length > 0) {
          processedFolders++
          setImporting(true, `Processing folder ${processedFolders}/${totalFolders}: ${folder} (${txtFiles.length} files)`)
          const folderNotes = await importTXT(txtFiles, folder)
          imported.push(...folderNotes)
        }
      }

      if (imported.length > 0) {
        setImporting(true, `Formatting ${imported.length} notes...`)
        await new Promise(r => setTimeout(r, 50))
        
        if (notes.length > 0) {
          addNotes(imported)
        } else {
          setNotes(imported)
        }
        
        setImporting(true, `Done! Loaded ${imported.length} notes from ${totalFolders} folders`)
        setTimeout(() => setImporting(false), 1200)
      } else {
        setImporting(false)
      }
    } catch (err) {
      console.error('Folder import error:', err)
      setImporting(false)
      alert('Failed to import folder')
    }

    if (folderInputRef.current) {
      folderInputRef.current.value = ''
    }
  }

  async function handleSessionImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const result = importSession(text)
      
      if (result.notes.length > 0 || result.annotations.length > 0) {
        useStore.setState({
          notes: result.notes,
          annotations: result.annotations,
          currentNoteIndex: 0
        })
        
        if (result.questions) {
          localStorage.setItem('annotator_questions', JSON.stringify(result.questions))
        }
        
        alert(`Loaded session: ${result.notes.length} notes, ${result.annotations.length} annotations`)
      }
    } catch (err) {
      console.error('Session import error:', err)
      alert('Failed to import session file')
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
    if (confirm(`Clear ${suggestedCount} suggested annotations? Manual annotations will be kept.`)) {
      clearSuggestedAnnotations()
    }
    setShowClearMenu(false)
  }

  function handleClearAllAnnotations() {
    if (confirm(`Clear all ${annotations.length} annotations? Notes will be kept.`)) {
      clearAllAnnotations()
    }
    setShowClearMenu(false)
  }

  async function handleClearEverything() {
    setShowClearMenu(false)
    
    // First confirmation
    const confirmMsg = `This will permanently delete:\n- ${notes.length} notes\n- ${annotations.length} annotations\n\nAre you sure? This cannot be undone.`
    if (!confirm(confirmMsg)) return
    
    // Second confirmation
    if (!confirm('Final confirmation: Delete everything?')) return
    
    // Only clear after both confirmations
    await clearSession()
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

      <input ref={fileInputRef} type="file" multiple accept=".json,.jsonl,.txt" onChange={handleFileImport} className="hidden" />
      {/* @ts-expect-error webkitdirectory is non-standard but widely supported */}
      <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple onChange={handleFolderImport} className="hidden" />
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
              onClick={() => { fileInputRef.current?.click(); setShowImportMenu(false) }}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50 dark:hover:bg-maple-700 dark:text-maple-200"
            >
              Import Files
            </button>
            <button
              onClick={() => { folderInputRef.current?.click(); setShowImportMenu(false) }}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50 dark:hover:bg-maple-700 dark:text-maple-200"
            >
              Import Folder
            </button>
            <div className="h-px bg-maple-100 dark:bg-maple-700" />
            <button
              onClick={() => { sessionInputRef.current?.click(); setShowImportMenu(false) }}
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
    </header>
  )
}
