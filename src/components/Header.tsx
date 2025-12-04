import { useStore } from '../hooks/useStore'
import { exportJSON, exportCSV, downloadFile, exportSession, importSession } from '../lib/exporters'
import { Download, Upload, Trash2, Settings, Check, Share2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { importJSON, importJSONL, importTXT } from '../lib/importers'
import { SettingsModal } from './SettingsModal'
import { loadQuestions } from '../lib/questions'

export function Header() {
  const { notes, annotations, mode, setMode, setNotes, addNotes, clearSession, lastSaved } = useStore()
  const [showSettings, setShowSettings] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showImportMenu, setShowImportMenu] = useState(false)
  const [saveIndicator, setSaveIndicator] = useState(false)
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
    function handleClickOutside(e: MouseEvent) {
      if (showExportMenu || showImportMenu) {
        setShowExportMenu(false)
        setShowImportMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showExportMenu, showImportMenu])

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      let imported: Awaited<ReturnType<typeof importJSON>> = []
      
      if (files.length === 1) {
        const file = files[0]
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
          imported = await importTXT(txtFiles)
        }
      }

      if (imported.length > 0) {
        if (notes.length > 0) {
          addNotes(imported)
        } else {
          setNotes(imported)
        }
      }
    } catch (err) {
      console.error('Import error:', err)
      alert('Failed to import files')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleFolderImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

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
      
      for (const [folder, folderFiles] of filesByFolder) {
        const txtFiles = folderFiles.filter(f => f.name.endsWith('.txt'))
        if (txtFiles.length > 0) {
          const folderNotes = await importTXT(txtFiles, folder)
          imported.push(...folderNotes)
        }
      }

      if (imported.length > 0) {
        if (notes.length > 0) {
          addNotes(imported)
        } else {
          setNotes(imported)
        }
      }
    } catch (err) {
      console.error('Folder import error:', err)
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
        // This replaces everything
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

  function handleExportJSON() {
    const content = exportJSON(notes, annotations)
    downloadFile(content, 'annotations.json', 'application/json')
    setShowExportMenu(false)
  }

  function handleExportCSV() {
    const content = exportCSV(notes, annotations)
    downloadFile(content, 'annotations.csv', 'text/csv')
    setShowExportMenu(false)
  }

  function handleShareSession() {
    const questions = loadQuestions()
    const content = exportSession(notes, annotations, questions)
    const timestamp = new Date().toISOString().slice(0, 10)
    downloadFile(content, `annotator-session-${timestamp}.json`, 'application/json')
    setShowExportMenu(false)
  }

  return (
    <header className="h-12 bg-white border-b border-maple-200 flex items-center px-4 gap-4">
      <span className="text-sm font-medium text-maple-800">Note Annotator</span>

      <div className="flex items-center gap-0.5 ml-4 bg-maple-100 p-0.5 rounded-full">
        <button
          onClick={() => setMode('annotate')}
          className={`px-3 py-1 text-xs rounded-full transition-all ${
            mode === 'annotate'
              ? 'bg-white text-maple-800 shadow-sm'
              : 'text-maple-500 hover:text-maple-700'
          }`}
        >
          Annotate
        </button>
        <button
          onClick={() => setMode('review')}
          className={`px-3 py-1 text-xs rounded-full transition-all ${
            mode === 'review'
              ? 'bg-white text-maple-800 shadow-sm'
              : 'text-maple-500 hover:text-maple-700'
          }`}
        >
          Review
        </button>
        <button
          onClick={() => setMode('format')}
          className={`px-3 py-1 text-xs rounded-full transition-all ${
            mode === 'format'
              ? 'bg-white text-maple-800 shadow-sm'
              : 'text-maple-500 hover:text-maple-700'
          }`}
        >
          Format
        </button>
      </div>

      <div className="flex-1" />

      {saveIndicator && (
        <div className="flex items-center gap-1 text-xs text-green-600">
          <Check size={14} />
          <span>Saved</span>
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple accept=".json,.jsonl,.txt" onChange={handleFileImport} className="hidden" />
      <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple onChange={handleFolderImport} className="hidden" />
      <input ref={sessionInputRef} type="file" accept=".json" onChange={handleSessionImport} className="hidden" />

      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setShowImportMenu(!showImportMenu); setShowExportMenu(false) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 hover:bg-maple-50 rounded-full border border-maple-200"
        >
          <Upload size={14} />
          Import
        </button>
        {showImportMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-maple-200 rounded-lg shadow-lg z-50 overflow-hidden min-w-[160px]" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { fileInputRef.current?.click(); setShowImportMenu(false) }}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50"
            >
              Import Files
            </button>
            <button
              onClick={() => { folderInputRef.current?.click(); setShowImportMenu(false) }}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50"
            >
              Import Folder
            </button>
            <div className="h-px bg-maple-100" />
            <button
              onClick={() => { sessionInputRef.current?.click(); setShowImportMenu(false) }}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50 text-amber-700"
            >
              Load Shared Session
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); setShowImportMenu(false) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 hover:bg-maple-50 rounded-full border border-maple-200"
        >
          <Download size={14} />
          Export
        </button>
        {showExportMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-maple-200 rounded-lg shadow-lg z-50 overflow-hidden min-w-[180px]" onClick={e => e.stopPropagation()}>
            <button
              onClick={handleExportJSON}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50"
            >
              Export Annotations (JSON)
            </button>
            <button
              onClick={handleExportCSV}
              className="block w-full px-4 py-2 text-xs text-left hover:bg-maple-50"
            >
              Export Annotations (CSV)
            </button>
            <div className="h-px bg-maple-100" />
            <button
              onClick={handleShareSession}
              className="flex items-center gap-2 w-full px-4 py-2 text-xs text-left hover:bg-amber-50 text-amber-700"
            >
              <Share2 size={12} />
              Share Full Session
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowSettings(true)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-maple-500 hover:bg-maple-50 rounded-full"
      >
        <Settings size={16} />
      </button>

      <button
        onClick={() => {
          if (confirm('Clear all notes and annotations?')) {
            clearSession()
          }
        }}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-maple-400 hover:text-red-500 hover:bg-red-50 rounded-full"
      >
        <Trash2 size={14} />
      </button>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </header>
  )
}
