import type { Note } from './types'
import { useStore, setBulkOperation } from '../hooks/useStore'

// Auto-format note text during import - exported for use in FormatView
export function formatNoteText(raw: string): string {
  let text = raw

  // normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n')

  // collapse multiple spaces
  text = text.replace(/[ \t]{2,}/g, ' ')

  // common section headers that should have line breaks before them
  const headers = [
    'CHIEF COMPLAINT', 'CC:', 'HPI:', 'HISTORY OF PRESENT ILLNESS',
    'PAST MEDICAL HISTORY', 'PMH:', 'PAST SURGICAL HISTORY', 'PSH:',
    'MEDICATIONS', 'CURRENT MEDICATIONS', 'ALLERGIES', 'ADVERSE REACTIONS',
    'SOCIAL HISTORY', 'SH:', 'FAMILY HISTORY', 'FH:',
    'REVIEW OF SYSTEMS', 'ROS:', 'SYSTEMS REVIEW',
    'PHYSICAL EXAM', 'PHYSICAL EXAMINATION', 'PE:',
    'VITALS:', 'VITAL SIGNS',
    'LABS:', 'LABORATORY', 'LAB VALUES',
    'IMAGING:', 'RADIOLOGY',
    'ASSESSMENT', 'IMPRESSION',
    'PLAN:', 'PLAN OF CARE', 'TREATMENT PLAN',
    'ASSESSMENT AND PLAN', 'A/P:',
    'RECOMMENDATIONS:',
    'FINDINGS:', 'TECHNIQUE:', 'INDICATION:', 'COMPARISON:',
    'OPERATIVE NOTE', 'OPERATIVE REPORT',
    'PREOPERATIVE DIAGNOSIS', 'POSTOPERATIVE DIAGNOSIS',
    'PROCEDURE:', 'OPERATION:',
    'ANESTHESIA:', 'SURGEON:',
    'EBL:', 'ESTIMATED BLOOD LOSS',
    'COMPLICATIONS:', 'SPECIMENS:',
    'DISPOSITION:', 'DISCHARGE INSTRUCTIONS',
    'FOLLOW UP:', 'FOLLOWUP:'
  ]

  // add line breaks before headers
  headers.forEach(header => {
    const regex = new RegExp(`(?<!\n\n)(?<!\n)(${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    text = text.replace(regex, '\n\n$1')
  })

  // fix common run-together patterns
  text = text.replace(/([a-z])([A-Z]{2,}:)/g, '$1\n\n$2')
  
  // ensure colon headers have content on same line or next
  text = text.replace(/([A-Z]{2,}:)\s*\n\s*\n/g, '$1\n')

  // trim each line
  text = text.split('\n').map(line => line.trim()).join('\n')

  // collapse multiple blank lines again
  text = text.replace(/\n{3,}/g, '\n\n')

  // remove leading/trailing whitespace
  text = text.trim()

  return text
}

export async function importJSON(file: File): Promise<Note[]> {
  const text = await file.text()
  const data = JSON.parse(text)
  
  if (Array.isArray(data)) {
    return data.map(normalizeNote)
  }
  
  if (data.notes && Array.isArray(data.notes)) {
    return data.notes.map(normalizeNote)
  }
  
  throw new Error('Invalid JSON format. Expected array of notes or { notes: [...] }')
}

export async function importJSONL(file: File): Promise<Note[]> {
  const text = await file.text()
  const lines = text.trim().split('\n').filter(Boolean)
  return lines.map(line => normalizeNote(JSON.parse(line)))
}

export async function importTXT(files: File[], noteType?: string): Promise<Note[]> {
  const notes: Note[] = []
  
  for (const file of files) {
    const rawText = await file.text()
    const text = formatNoteText(rawText)  // Auto-format
    const id = file.name.replace(/\.txt$/, '')
    notes.push({
      id,
      text,
      meta: { 
        source: file.name,
        type: noteType
      }
    })
  }
  
  return notes
}

export interface ImportProgress {
  phase: 'scanning' | 'processing' | 'formatting' | 'done'
  current: number
  total: number
  currentFile?: string
  currentFolder?: string
}

type ProgressCallback = (progress: ImportProgress) => void

// Shared file processing - used by both importFiles and importFromDrop
async function processFileWithFolder(
  file: File, 
  folder: string,
  notes: Note[]
): Promise<void> {
  try {
    if (file.name.endsWith('.txt')) {
      const rawText = await file.text()
      const text = formatNoteText(rawText)
      notes.push({
        id: file.name.replace(/\.txt$/, ''),
        text,
        meta: { source: file.name, type: folder || undefined }
      })
    } else if (file.name.endsWith('.json')) {
      const imported = await importJSON(file)
      imported.forEach(n => {
        if (folder && !n.meta?.type) n.meta = { ...n.meta, type: folder }
        notes.push(n)
      })
    } else if (file.name.endsWith('.jsonl')) {
      const imported = await importJSONL(file)
      imported.forEach(n => {
        if (folder && !n.meta?.type) n.meta = { ...n.meta, type: folder }
        notes.push(n)
      })
    }
  } catch (err) {
    console.error(`Failed to import ${file.name}:`, err)
  }
}

// Unified import function for file input
export async function importFiles(
  files: FileList | File[],
  onProgress?: ProgressCallback
): Promise<Note[]> {
  const fileArray = Array.from(files)
  const total = fileArray.length
  
  onProgress?.({ phase: 'scanning', current: 0, total })
  
  // Group by folder (from webkitRelativePath)
  const byFolder = new Map<string, File[]>()
  
  for (const file of fileArray) {
    const path = (file as any).webkitRelativePath || ''
    const parts = path.split('/')
    const folder = parts.length > 1 ? parts[parts.length - 2] : ''
    
    if (!byFolder.has(folder)) byFolder.set(folder, [])
    byFolder.get(folder)!.push(file)
  }
  
  const notes: Note[] = []
  let processed = 0
  
  for (const [folder, folderFiles] of byFolder) {
    for (const file of folderFiles) {
      processed++
      onProgress?.({ 
        phase: 'processing', 
        current: processed, 
        total, 
        currentFile: file.name,
        currentFolder: folder || undefined
      })
      
      await processFileWithFolder(file, folder, notes)
    }
  }
  
  onProgress?.({ phase: 'done', current: notes.length, total: notes.length })
  return notes
}

// Import from drag-drop DataTransfer
export async function importFromDrop(
  dataTransfer: DataTransfer,
  onProgress?: ProgressCallback
): Promise<Note[]> {
  const entries: FileSystemEntry[] = []
  
  // Get entries from DataTransfer
  for (let i = 0; i < dataTransfer.items.length; i++) {
    const entry = dataTransfer.items[i].webkitGetAsEntry()
    if (entry) entries.push(entry)
  }
  
  if (entries.length === 0) return []
  
  // Collect all files first to get total count
  const allFiles: { file: File; folder: string }[] = []
  
  async function collectFiles(entry: FileSystemEntry, folder: string): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject)
      })
      allFiles.push({ file, folder })
    } else if (entry.isDirectory) {
      const dir = entry as FileSystemDirectoryEntry
      const reader = dir.createReader()
      let batch: FileSystemEntry[]
      
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject)
        })
        for (const sub of batch) {
          await collectFiles(sub, dir.name)
        }
      } while (batch.length > 0)
    }
  }
  
  onProgress?.({ phase: 'scanning', current: 0, total: 0 })
  
  for (const entry of entries) {
    await collectFiles(entry, '')
  }
  
  const notes: Note[] = []
  const total = allFiles.length
  let processed = 0
  
  for (const { file, folder } of allFiles) {
    processed++
    onProgress?.({ 
      phase: 'processing', 
      current: processed, 
      total, 
      currentFile: file.name,
      currentFolder: folder || undefined
    })
    
    await processFileWithFolder(file, folder, notes)
  }
  
  onProgress?.({ phase: 'done', current: notes.length, total: notes.length })
  return notes
}

/**
 * Unified import handler - handles all the common import logic
 * Used by both App.tsx (drag-drop) and Header.tsx (file input)
 * 
 * Note: Gets fresh state at decision time to avoid stale closure issues
 * when clearSession is called during import.
 */
export async function handleImportWithProgress(
  importFn: () => Promise<Note[]>,
  options: {
    onProgress?: (msg: string) => void
    onSuccess?: (notes: Note[]) => void
    onError?: (error: Error) => void
  } = {}
): Promise<void> {
  const { setImporting } = useStore.getState()
  
  setImporting(true, 'Preparing...')
  
  try {
    setBulkOperation(true)
    
    const imported = await importFn()
    
    if (imported.length > 0) {
      // Get FRESH state at decision time to handle case where
      // clearSession was called during the async import operation
      const { notes: currentNotes, addNotes, setNotes } = useStore.getState()
      
      // Add or set notes based on whether we have existing notes
      if (currentNotes.length > 0) {
        addNotes(imported)
      } else {
        setNotes(imported)
      }
      setBulkOperation(false)
      setImporting(true, `${imported.length} notes imported`)
      options.onSuccess?.(imported)
      setTimeout(() => setImporting(false), 300)
    } else {
      setBulkOperation(false)
      setImporting(true, 'No valid files found')
      setTimeout(() => setImporting(false), 800)
    }
  } catch (err) {
    console.error('Import error:', err)
    setBulkOperation(false)
    setImporting(true, 'Import failed')
    options.onError?.(err as Error)
    setTimeout(() => setImporting(false), 1000)
  }
}

function normalizeNote(raw: Record<string, unknown>): Note {
  const rawText = String(raw.text || '')
  return {
    id: String(raw.id || raw.note_id || `note_${Date.now()}_${Math.random().toString(36).slice(2,6)}`),
    text: formatNoteText(rawText),  // Auto-format
    meta: {
      type: raw.note_type as string | undefined,
      date: raw.date as string | undefined,
      source: raw.source as string | undefined,
      ...(typeof raw.meta === 'object' ? raw.meta as Record<string, string> : {})
    }
  }
}
