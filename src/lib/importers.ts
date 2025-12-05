import type { Note } from './types'
import { useStore, setBulkOperation } from '../hooks/useStore'
import { formatNoteText } from './formatter'

// Re-export formatNoteText from the comprehensive formatter
// This provides the full clinical note formatting pipeline with:
// - 140+ section headers
// - Physical Exam formatting
// - Review of Systems formatting  
// - Medication list formatting
// - Lab value formatting
// - Drug name preservation
// - And much more...
export { formatNoteText }

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

// Batch size for parallel file processing
// Higher = faster but more memory; lower = slower but less memory pressure
const PARALLEL_BATCH_SIZE = 20

// Shared file processing - used by both importFiles and importFromDrop
// Returns processed notes instead of mutating array (better for parallelization)
async function processFileWithFolder(
  file: File, 
  folder: string
): Promise<Note[]> {
  const results: Note[] = []
  try {
    if (file.name.endsWith('.txt')) {
      const rawText = await file.text()
      const text = formatNoteText(rawText)
      results.push({
        id: file.name.replace(/\.txt$/, ''),
        text,
        meta: { source: file.name, type: folder || undefined }
      })
    } else if (file.name.endsWith('.json')) {
      const imported = await importJSON(file)
      imported.forEach(n => {
        if (folder && !n.meta?.type) n.meta = { ...n.meta, type: folder }
        results.push(n)
      })
    } else if (file.name.endsWith('.jsonl')) {
      const imported = await importJSONL(file)
      imported.forEach(n => {
        if (folder && !n.meta?.type) n.meta = { ...n.meta, type: folder }
        results.push(n)
      })
    }
  } catch (err) {
    console.error(`Failed to import ${file.name}:`, err)
  }
  return results
}

// Process files in parallel batches for better performance
async function processFilesInBatches(
  files: { file: File; folder: string }[],
  onProgress?: (processed: number, total: number, currentFile?: string) => void
): Promise<Note[]> {
  const allNotes: Note[] = []
  const total = files.length
  let processed = 0
  
  // Process in parallel batches
  for (let i = 0; i < files.length; i += PARALLEL_BATCH_SIZE) {
    const batch = files.slice(i, i + PARALLEL_BATCH_SIZE)
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(({ file, folder }) => processFileWithFolder(file, folder))
    )
    
    // Flatten and collect results
    for (const notes of batchResults) {
      allNotes.push(...notes)
    }
    
    processed += batch.length
    onProgress?.(processed, total, batch[batch.length - 1]?.file.name)
  }
  
  return allNotes
}

// Unified import function for file input
// Optimized with parallel batch processing for faster imports
export async function importFiles(
  files: FileList | File[],
  onProgress?: ProgressCallback
): Promise<Note[]> {
  const fileArray = Array.from(files)
  const total = fileArray.length
  
  onProgress?.({ phase: 'scanning', current: 0, total })
  
  // Collect all files with their folder info
  const allFiles: { file: File; folder: string }[] = []
  
  for (const file of fileArray) {
    const path = (file as any).webkitRelativePath || ''
    const parts = path.split('/')
    const folder = parts.length > 1 ? parts[parts.length - 2] : ''
    allFiles.push({ file, folder })
  }
  
  // Process files in parallel batches
  const notes = await processFilesInBatches(allFiles, (processed, total, currentFile) => {
    onProgress?.({ 
      phase: 'processing', 
      current: processed, 
      total, 
      currentFile
    })
  })
  
  onProgress?.({ phase: 'done', current: notes.length, total: notes.length })
  return notes
}

// Import from drag-drop DataTransfer
// Optimized with parallel batch processing for faster imports
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
  
  // Process files in parallel batches (much faster than sequential)
  const notes = await processFilesInBatches(allFiles, (processed, total, currentFile) => {
    onProgress?.({ 
      phase: 'processing', 
      current: processed, 
      total, 
      currentFile
    })
  })
  
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
