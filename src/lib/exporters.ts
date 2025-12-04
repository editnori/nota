import type { Note, Annotation, Question } from './types'
import { loadQuestions } from './questions'

interface ExportData {
  exportedAt: string
  stats: {
    totalNotes: number
    annotatedNotes: number
    totalAnnotations: number
    manualAnnotations: number
    suggestedAnnotations: number
    byQuestion: Record<string, number>
  }
  notes: Note[]
  annotations: Annotation[]
}

interface SessionData {
  version: string
  exportedAt: string
  notes: Note[]
  annotations: Annotation[]
  questions: Question[]
}

export function exportJSON(notes: Note[], annotations: Annotation[]): string {
  const questions = loadQuestions()
  const annotatedNoteIds = new Set(annotations.map(a => a.noteId))
  const byQuestion: Record<string, number> = {}
  
  questions.forEach(q => {
    byQuestion[q.id] = annotations.filter(a => a.questions.includes(q.id)).length
  })

  const data: ExportData = {
    exportedAt: new Date().toISOString(),
    stats: {
      totalNotes: notes.length,
      annotatedNotes: annotatedNoteIds.size,
      totalAnnotations: annotations.length,
      manualAnnotations: annotations.filter(a => a.source !== 'suggested').length,
      suggestedAnnotations: annotations.filter(a => a.source === 'suggested').length,
      byQuestion
    },
    notes,
    annotations
  }

  return JSON.stringify(data, null, 2)
}

export function exportCSV(notes: Note[], annotations: Annotation[]): string {
  const noteMap = new Map(notes.map(n => [n.id, n]))
  const rows: string[] = []
  
  // Updated CSV header with source and created_at
  rows.push('annotation_id,note_id,note_type,start,end,text,questions,source,created_at,comment,context_before,context_after')

  for (const ann of annotations) {
    const note = noteMap.get(ann.noteId)
    if (!note) continue

    const contextBefore = note.text.slice(Math.max(0, ann.start - 50), ann.start).replace(/[\n\r]/g, ' ')
    const contextAfter = note.text.slice(ann.end, ann.end + 50).replace(/[\n\r]/g, ' ')

    const row = [
      ann.id,
      ann.noteId,
      note.meta?.type || '',
      ann.start.toString(),
      ann.end.toString(),
      `"${ann.text.replace(/"/g, '""').replace(/[\n\r]/g, ' ')}"`,
      ann.questions.join(';'),
      ann.source || 'manual',
      ann.createdAt ? new Date(ann.createdAt).toISOString() : '',
      ann.comment ? `"${ann.comment.replace(/"/g, '""')}"` : '',
      `"${contextBefore.replace(/"/g, '""')}"`,
      `"${contextAfter.replace(/"/g, '""')}"`
    ]
    rows.push(row.join(','))
  }

  return rows.join('\n')
}

export function exportSession(notes: Note[], annotations: Annotation[], questions: Question[]): string {
  const data: SessionData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    notes,
    annotations,
    questions
  }
  return JSON.stringify(data, null, 2)
}

export function importSession(jsonString: string): { notes: Note[], annotations: Annotation[], questions?: Question[] } {
  const data = JSON.parse(jsonString)
  
  // handle session format
  if (data.version && data.notes && data.annotations) {
    return {
      notes: data.notes,
      annotations: data.annotations,
      questions: data.questions
    }
  }
  
  // handle regular export format
  if (data.notes && data.annotations) {
    return {
      notes: data.notes,
      annotations: data.annotations
    }
  }
  
  throw new Error('Invalid session format')
}

// Check if running in Tauri desktop app
async function isTauri(): Promise<boolean> {
  try {
    // Tauri 2.x detection
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      return true
    }
    // Fallback check
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function downloadFile(content: string, filename: string, type: string) {
  const inTauri = await isTauri()
  
  if (inTauri) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      
      // Determine filters based on file type
      let filters = [{ name: 'All Files', extensions: ['*'] }]
      
      if (filename.endsWith('.json')) {
        filters = [{ name: 'JSON Files', extensions: ['json'] }]
      } else if (filename.endsWith('.csv')) {
        filters = [{ name: 'CSV Files', extensions: ['csv'] }]
      } else if (filename.endsWith('.txt')) {
        filters = [{ name: 'Text Files', extensions: ['txt'] }]
      }
      
      const filePath = await save({
        defaultPath: filename,
        filters,
        title: 'Save file'
      })
      
      if (filePath) {
        await writeTextFile(filePath, content)
        return // success
      }
      // User cancelled - don't fallback
      return
    } catch (err) {
      console.error('Tauri save error:', err)
      // Only fallback if Tauri APIs failed to load
      browserDownload(content, filename, type)
    }
  } else {
    browserDownload(content, filename, type)
  }
}

function browserDownload(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
