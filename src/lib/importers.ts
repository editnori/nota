import type { Note } from './types'

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
    const text = await file.text()
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
        const text = await file.text()
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

function normalizeNote(raw: Record<string, unknown>): Note {
  return {
    id: String(raw.id || raw.note_id || `note_${Date.now()}_${Math.random().toString(36).slice(2,6)}`),
    text: String(raw.text || ''),
    meta: {
      type: raw.note_type as string | undefined,
      date: raw.date as string | undefined,
      source: raw.source as string | undefined,
      ...(typeof raw.meta === 'object' ? raw.meta as Record<string, string> : {})
    }
  }
}
