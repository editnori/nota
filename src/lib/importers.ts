import type { Note } from './types'

// Auto-format note text during import
function formatNoteText(raw: string): string {
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

export async function importFolder(items: FileSystemEntry[]): Promise<Note[]> {
  const notes: Note[] = []
  
  async function processEntry(entry: FileSystemEntry, noteType?: string): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject)
      })
      
      if (file.name.endsWith('.txt')) {
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
      } else if (file.name.endsWith('.json')) {
        const imported = await importJSON(file)
        imported.forEach(n => {
          if (noteType && !n.meta?.type) {
            n.meta = { ...n.meta, type: noteType }
          }
          notes.push(n)
        })
      } else if (file.name.endsWith('.jsonl')) {
        const imported = await importJSONL(file)
        imported.forEach(n => {
          if (noteType && !n.meta?.type) {
            n.meta = { ...n.meta, type: noteType }
          }
          notes.push(n)
        })
      }
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry
      const reader = dirEntry.createReader()
      
      // folder name becomes note type
      const folderNoteType = dirEntry.name
      
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject)
      })
      
      for (const subEntry of entries) {
        await processEntry(subEntry, folderNoteType)
      }
    }
  }
  
  for (const item of items) {
    await processEntry(item)
  }
  
  return notes
}

// Import from DataTransferItemList (for drag-drop)
export async function importFromDataTransfer(items: DataTransferItemList): Promise<Note[]> {
  const entries: FileSystemEntry[] = []
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry()
      if (entry) {
        entries.push(entry)
      }
    }
  }
  
  if (entries.length === 0) {
    return []
  }
  
  return importFolder(entries)
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
