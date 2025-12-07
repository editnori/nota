import type { Note, FormatterMode } from './types'
import { useStore, setBulkOperation } from '../hooks/useStore'
import { formatNoteText } from './formatter'
import { formatNote } from './bilstm-formatter'

// Re-export formatNoteText from the comprehensive formatter
export { formatNoteText }

// Format text based on mode - async because model mode is async
export async function formatTextWithMode(raw: string, mode: FormatterMode): Promise<string> {
  if (mode === 'none') return raw
  if (mode === 'regex') return formatNoteText(raw)
  // Model mode
  const result = await formatNote(raw, { mode: 'model' })
  return result.formatted
}

export async function importJSON(file: File, mode: FormatterMode = 'regex'): Promise<Note[]> {
  const text = await file.text()
  const data = JSON.parse(text)
  
  if (Array.isArray(data)) {
    return Promise.all(data.map(d => normalizeNote(d, mode)))
  }
  
  if (data.notes && Array.isArray(data.notes)) {
    return Promise.all(data.notes.map((d: Record<string, unknown>) => normalizeNote(d, mode)))
  }
  
  throw new Error('Invalid JSON format. Expected array of notes or { notes: [...] }')
}

export async function importJSONL(file: File, mode: FormatterMode = 'regex'): Promise<Note[]> {
  const text = await file.text()
  const lines = text.trim().split('\n').filter(Boolean)
  return Promise.all(lines.map(line => normalizeNote(JSON.parse(line), mode)))
}

export async function importTXT(files: File[], noteType?: string, mode: FormatterMode = 'regex'): Promise<Note[]> {
  const notes: Note[] = []
  
  for (const file of files) {
    const rawText = await file.text()
    const text = await formatTextWithMode(rawText, mode)
    const id = file.name.replace(/\.txt$/, '')
    notes.push({
      id,
      text,
      meta: { 
        source: file.name,
        type: noteType,
        rawText: rawText  // Store original for comparison
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
  folder: string,
  mode: FormatterMode = 'regex'
): Promise<Note[]> {
  const results: Note[] = []
  try {
    if (file.name.endsWith('.txt')) {
      const rawText = await file.text()
      const text = await formatTextWithMode(rawText, mode)
      results.push({
        id: file.name.replace(/\.txt$/, ''),
        text,
        meta: { source: file.name, type: folder || undefined, rawText: rawText }
      })
    } else if (file.name.endsWith('.json')) {
      const imported = await importJSON(file, mode)
      imported.forEach(n => {
        if (folder && !n.meta?.type) n.meta = { ...n.meta, type: folder }
        results.push(n)
      })
    } else if (file.name.endsWith('.jsonl')) {
      const imported = await importJSONL(file, mode)
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
  mode: FormatterMode = 'regex',
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
      batch.map(({ file, folder }) => processFileWithFolder(file, folder, mode))
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
  onProgress?: ProgressCallback,
  mode: FormatterMode = 'regex'
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
  const notes = await processFilesInBatches(allFiles, mode, (processed, total, currentFile) => {
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
  onProgress?: ProgressCallback,
  mode: FormatterMode = 'regex'
): Promise<Note[]> {
  const allFiles: { file: File; folder: string }[] = []
  
  // Try to get entries from DataTransfer (supports folders)
  const entries: FileSystemEntry[] = []
  if (dataTransfer.items) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i]
      // webkitGetAsEntry may not be available in all browsers
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry()
        if (entry) entries.push(entry)
      }
    }
  }
  
  onProgress?.({ phase: 'scanning', current: 0, total: 0 })
  
  // If we have entries (supports folder traversal)
  if (entries.length > 0) {
    async function collectFiles(entry: FileSystemEntry, folder: string): Promise<void> {
      if (entry.isFile) {
        try {
          const file = await new Promise<File>((resolve, reject) => {
            (entry as FileSystemFileEntry).file(resolve, reject)
          })
          // Only add supported file types
          if (file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.jsonl')) {
            allFiles.push({ file, folder })
          }
        } catch (err) {
          console.warn('Failed to read file entry:', entry.name, err)
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
            await collectFiles(sub, dir.name)
          }
        } while (batch.length > 0)
      }
    }
    
    for (const entry of entries) {
      await collectFiles(entry, '')
    }
  } 
  // Fallback: use dataTransfer.files directly (doesn't support folders but works everywhere)
  else if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i]
      // Only add supported file types
      if (file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.jsonl')) {
        allFiles.push({ file, folder: '' })
      }
    }
  }
  
  // If no valid files found, return empty
  if (allFiles.length === 0) {
    console.warn('importFromDrop: No valid files found. Supported: .txt, .json, .jsonl')
    return []
  }
  
  // Process files in parallel batches (much faster than sequential)
  const notes = await processFilesInBatches(allFiles, mode, (processed, total, currentFile) => {
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
      
      // Re-enable saves and show success - use synchronous update
      setBulkOperation(false)
      
      // Brief success message then clear - wrapped in Promise for proper timing
      setImporting(true, `${imported.length} notes imported`)
      options.onSuccess?.(imported)
      
      // Wait a frame to ensure React has processed the notes state update
      // before hiding the import overlay
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            setImporting(false)
            resolve()
          }, 300)
        })
      })
    } else {
      setBulkOperation(false)
      setImporting(true, 'No valid files found')
      await new Promise(resolve => setTimeout(resolve, 800))
      setImporting(false)
    }
  } catch (err) {
    console.error('Import error:', err)
    setBulkOperation(false)
    setImporting(true, 'Import failed')
    options.onError?.(err as Error)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setImporting(false)
  }
}

async function normalizeNote(raw: Record<string, unknown>, mode: FormatterMode = 'regex'): Promise<Note> {
  const originalText = String(raw.text || '')
  const formattedText = await formatTextWithMode(originalText, mode)
  return {
    id: String(raw.id || raw.note_id || `note_${Date.now()}_${Math.random().toString(36).slice(2,6)}`),
    text: formattedText,
    meta: {
      type: raw.note_type as string | undefined,
      date: raw.date as string | undefined,
      source: raw.source as string | undefined,
      rawText: originalText,  // Store original for comparison
      ...(typeof raw.meta === 'object' ? raw.meta as Record<string, string> : {})
    }
  }
}
