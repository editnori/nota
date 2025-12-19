import { initRadiologyModel, extractRadiologyEntities } from './radiology-inference'
import { loadQuestions } from './questions'
import type { Note, EntityType } from './types'
import { useStore, setBulkOperation } from '../hooks/useStore'

const AUTO_SUGGEST_KEY = 'nota_autoSuggest_q6'

export function isAutoSuggestEnabled(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_SUGGEST_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

export function setAutoSuggestEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_SUGGEST_KEY, enabled ? 'true' : 'false')
  } catch {
    // Ignore storage failures (e.g. privacy mode)
  }
}

function pickRadiologyQuestionId(): string | null {
  const questions = loadQuestions()
  const q6 = questions.find(q => q.id === 'Q6')
  if (q6) return q6.id
  const fallback = questions.find(q => {
    const name = q.name.toLowerCase()
    const hint = q.hint.toLowerCase()
    return (
      name.includes('radiology') ||
      name.includes('imaging') ||
      hint.includes('radiology') ||
      hint.includes('imaging') ||
      name.includes('stone') ||
      hint.includes('stone')
    )
  })
  return fallback?.id || null
}

function isRadiologyNote(note: Note): boolean {
  const id = (note.id || '').toLowerCase()
  if (id.startsWith('rad') || id.includes('radiology')) return true
  const type = note.meta?.type?.toLowerCase() || ''
  if (type.includes('rad') || type.includes('imaging') || type.includes('ultrasound') || type.includes('ct')) return true
  const text = (note.text || note.meta?.rawText || '').toLowerCase()
  return (
    text.includes('renal ultrasound') ||
    text.includes('renal sonogram') ||
    text.includes('ct abdomen') ||
    text.includes('ct urogram') ||
    text.includes('impression:') ||
    text.includes('findings:') ||
    text.includes('kidneys') ||
    text.includes('ureter') ||
    text.includes('hydronephrosis')
  )
}

export async function autoSuggestRadiologyAnnotations(notes: Note[]): Promise<number> {
  if (!isAutoSuggestEnabled()) return 0
  if (!notes.length) return 0
  const questionId = pickRadiologyQuestionId()
  if (!questionId) return 0

  const { addBulkAnnotations, annotationsByNote, setImporting } = useStore.getState()

  // Filter to likely radiology notes first to avoid unnecessary model loads.
  const candidateNotes = notes.filter(isRadiologyNote)
  if (candidateNotes.length === 0) return 0

  setImporting(true, `Analyzing radiology (${candidateNotes.length} notes)...`)

  let added = 0

  try {
    await initRadiologyModel()

    const annotationsToAdd: { noteId: string; start: number; end: number; text: string; questions: string[]; entityType?: EntityType; confidence?: number }[] = []
    const batchSize = 20
    let processed = 0

    for (let i = 0; i < candidateNotes.length; i += batchSize) {
      const batch = candidateNotes.slice(i, i + batchSize)
      await Promise.all(batch.map(async (note) => {
        try {
          const entities = await extractRadiologyEntities(note.text)
          if (entities.length === 0) return

          const existing = annotationsByNote?.get?.(note.id) || []
          const existingKeys = new Set(existing.map(a => `${a.start}:${a.end}`))

          for (const ent of entities) {
            const key = `${ent.start}:${ent.end}`
            if (existingKeys.has(key)) continue
            // Map model entity type to our EntityType
            const rawType = String(ent.type || '').toUpperCase()
            const entityType: EntityType | undefined = 
              rawType === 'POSITIVE' ? 'POSITIVE' :
              rawType === 'ANATOMY' ? 'ANATOMY' :
              rawType === 'DOSE' ? 'DOSE' :
              undefined
            annotationsToAdd.push({
              noteId: note.id,
              start: ent.start,
              end: ent.end,
              text: ent.text,
              questions: [questionId],
              entityType,
              confidence: ent.confidence
            })
          }
        } catch (err) {
          console.error(`[AutoSuggest] Failed on ${note.id}:`, err)
        }
      }))

      processed = Math.min(i + batchSize, candidateNotes.length)
      setImporting(true, `Analyzing radiology ${processed}/${candidateNotes.length}`)

      // Yield to UI
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    if (annotationsToAdd.length > 0) {
      setBulkOperation(true)
      addBulkAnnotations(annotationsToAdd)
      setBulkOperation(false)
      added = annotationsToAdd.length
    }
  } catch (err) {
    console.error('[AutoSuggest] Model init failed:', err)
  } finally {
    setImporting(false)
  }

  return added
}
