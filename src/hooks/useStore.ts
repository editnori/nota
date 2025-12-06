import { create } from 'zustand'
import type { Note, Annotation, Mode } from '../lib/types'
import { loadSession, saveSession, clearStorage } from '../lib/storage'

interface UndoAction {
  type: 'add' | 'remove' | 'update'
  annotation: Annotation
  previousState?: Partial<Annotation>
}

interface State {
  notes: Note[]
  annotations: Annotation[]
  // Indexes for O(1) lookups
  annotationsByNote: Map<string, Annotation[]>
  annotationsById: Map<string, Annotation>  // For O(1) lookup by ID
  currentNoteIndex: number
  mode: Mode
  selectedQuestion: string | null
  lastSaved: number | null
  isLoaded: boolean
  isTransitioning: boolean  // True during clear/load to prevent rendering issues
  undoStack: UndoAction[]
  fontSize: number
  darkMode: boolean
  isImporting: boolean
  importProgress: string
  highlightedAnnotation: string | null
  filteredNoteIds: Set<string> | null  // Smart filter results
  
  setNotes: (notes: Note[]) => void
  addNotes: (notes: Note[]) => void
  addAnnotation: (ann: Omit<Annotation, 'id' | 'createdAt'>) => void
  addBulkAnnotations: (anns: Omit<Annotation, 'id' | 'createdAt' | 'source'>[]) => void
  removeAnnotation: (id: string) => void
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void
  setCurrentNoteIndex: (index: number) => void
  setMode: (mode: Mode) => void
  setSelectedQuestion: (q: string | null) => void
  clearNoteAnnotations: (noteId: string) => void
  clearAllAnnotations: () => void
  clearSuggestedAnnotations: () => void
  clearSession: () => Promise<void>
  initSession: () => Promise<void>
  undo: () => void
  setFontSize: (size: number) => void
  setDarkMode: (dark: boolean) => void
  setImporting: (importing: boolean, progress?: string) => void
  setHighlightedAnnotation: (id: string | null) => void
  setFilteredNoteIds: (ids: Set<string> | null) => void
  getAnnotationsForNote: (noteId: string) => Annotation[]
  getAnnotationById: (id: string) => Annotation | undefined
}

// Build annotation indexes
export interface AnnotationIndexes {
  byNote: Map<string, Annotation[]>
  byId: Map<string, Annotation>
}

// Full rebuild - exported for session import
export function buildAnnotationIndexes(annotations: Annotation[]): AnnotationIndexes {
  const byNote = new Map<string, Annotation[]>()
  const byId = new Map<string, Annotation>()
  
  for (const ann of annotations) {
    // By note ID
    const existing = byNote.get(ann.noteId)
    if (existing) {
      existing.push(ann)
    } else {
      byNote.set(ann.noteId, [ann])
    }
    // By annotation ID
    byId.set(ann.id, ann)
  }
  
  return { byNote, byId }
}

// Incremental add - O(1) instead of O(n)
function addToIndexes(
  annotation: Annotation,
  byNote: Map<string, Annotation[]>,
  byId: Map<string, Annotation>
): { byNote: Map<string, Annotation[]>, byId: Map<string, Annotation> } {
  // Clone maps for immutability
  const newByNote = new Map(byNote)
  const newById = new Map(byId)
  
  // Add to byNote
  const existing = newByNote.get(annotation.noteId)
  if (existing) {
    newByNote.set(annotation.noteId, [...existing, annotation])
  } else {
    newByNote.set(annotation.noteId, [annotation])
  }
  
  // Add to byId
  newById.set(annotation.id, annotation)
  
  return { byNote: newByNote, byId: newById }
}

// Incremental remove - O(n) for the note's annotations only, not all annotations
function removeFromIndexes(
  annotationId: string,
  noteId: string,
  byNote: Map<string, Annotation[]>,
  byId: Map<string, Annotation>
): { byNote: Map<string, Annotation[]>, byId: Map<string, Annotation> } {
  const newByNote = new Map(byNote)
  const newById = new Map(byId)
  
  // Remove from byNote
  const existing = newByNote.get(noteId)
  if (existing) {
    const filtered = existing.filter(a => a.id !== annotationId)
    if (filtered.length > 0) {
      newByNote.set(noteId, filtered)
    } else {
      newByNote.delete(noteId)
    }
  }
  
  // Remove from byId
  newById.delete(annotationId)
  
  return { byNote: newByNote, byId: newById }
}

// Incremental update
function updateInIndexes(
  annotation: Annotation,
  byNote: Map<string, Annotation[]>,
  byId: Map<string, Annotation>
): { byNote: Map<string, Annotation[]>, byId: Map<string, Annotation> } {
  const newByNote = new Map(byNote)
  const newById = new Map(byId)
  
  // Update in byNote
  const existing = newByNote.get(annotation.noteId)
  if (existing) {
    newByNote.set(annotation.noteId, existing.map(a => a.id === annotation.id ? annotation : a))
  }
  
  // Update in byId
  newById.set(annotation.id, annotation)
  
  return { byNote: newByNote, byId: newById }
}

// Debounced save to avoid too many writes
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let isBulkOperation = false
let isSaving = false
let lastSavedHash = ''
let lastAnnotationTime = 0

// Reset all module-level save state - called by clearSession
function resetSaveState() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  isBulkOperation = false  // Reset bulk operation flag to ensure clean state
  isSaving = false
  lastSavedHash = ''
  lastAnnotationTime = 0
}

// Annotation batching for rapid highlight spam
let pendingAnnotations: Annotation[] = []
let batchTimeout: ReturnType<typeof setTimeout> | null = null
const BATCH_DELAY_MS = 16 // ~1 frame at 60fps

// Export for overlap detection during rapid highlighting
export function getPendingAnnotationsForNote(noteId: string): Annotation[] {
  return pendingAnnotations.filter(a => a.noteId === noteId)
}

function flushAnnotationBatch() {
  if (pendingAnnotations.length === 0) return
  
  const toAdd = pendingAnnotations
  pendingAnnotations = []
  batchTimeout = null
  
  const state = useStore.getState()
  
  // Batch all annotations into single state update
  const newAnnotations = [...state.annotations, ...toAdd]
  
  // Rebuild indexes once for all new annotations (not once per annotation)
  const newByNote = new Map(state.annotationsByNote)
  const newById = new Map(state.annotationsById)
  
  for (const ann of toAdd) {
    // Add to byNote
    const existing = newByNote.get(ann.noteId)
    if (existing) {
      newByNote.set(ann.noteId, [...existing, ann])
    } else {
      newByNote.set(ann.noteId, [ann])
    }
    // Add to byId
    newById.set(ann.id, ann)
  }
  
  // Single state update for entire batch
  useStore.setState({
    annotations: newAnnotations,
    annotationsByNote: newByNote,
    annotationsById: newById,
    undoStack: [...state.undoStack.slice(-(20 - toAdd.length)), ...toAdd.map(a => ({ type: 'add' as const, annotation: a }))],
    lastSaved: debouncedSave()
  })
}

// Simple hash to detect if data actually changed
function quickHash(notes: Note[], annotations: Annotation[]): string {
  return `${notes.length}-${annotations.length}-${annotations[annotations.length - 1]?.id || ''}`
}

function debouncedSave() {
  // Skip saving during bulk operations or if already saving
  if (isBulkOperation || isSaving) return Date.now()
  
  const now = Date.now()
  const timeSinceLastAnnotation = now - lastAnnotationTime
  lastAnnotationTime = now
  
  // Dynamic debounce: longer delay during rapid annotation
  // If annotating quickly (< 1s between), wait longer (2s)
  // If slower annotating, use standard delay (500ms)
  const debounceMs = timeSinceLastAnnotation < 1000 ? 2000 : 500
  
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    // Use requestIdleCallback if available to avoid blocking UI
    const doSave = async () => {
      if (isSaving) return
      
      // Get FRESH state when actually saving
      const freshState = useStore.getState()
      
      // Check if data actually changed
      const newHash = quickHash(freshState.notes, freshState.annotations)
      if (newHash === lastSavedHash) {
        return // Nothing changed, skip save
      }
      
      isSaving = true
      try {
        await saveSession({
          notes: freshState.notes,
          annotations: freshState.annotations,
          currentNoteIndex: freshState.currentNoteIndex,
          mode: freshState.mode,
          selectedQuestion: freshState.selectedQuestion
        })
        lastSavedHash = newHash
      } finally {
        isSaving = false
      }
    }
    
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(doSave, { timeout: 5000 })
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(doSave, 100)
    }
  }, debounceMs)
  return Date.now()
}

// Call this to temporarily disable saves during bulk operations
export function setBulkOperation(bulk: boolean) {
  isBulkOperation = bulk
  if (!bulk) {
    // Trigger save when bulk operation ends
    debouncedSave()
  }
}

// Load preferences from localStorage
function loadPreferences() {
  try {
    const fontSize = localStorage.getItem('nota_fontSize')
    const darkMode = localStorage.getItem('nota_darkMode')
    return {
      fontSize: fontSize ? parseInt(fontSize) : 13,
      darkMode: darkMode === 'true'
    }
  } catch {
    return { fontSize: 13, darkMode: false }
  }
}

const prefs = loadPreferences()

export const useStore = create<State>((set, get) => ({
  notes: [],
  annotations: [],
  annotationsByNote: new Map(),
  annotationsById: new Map(),
  currentNoteIndex: 0,
  mode: 'annotate',
  selectedQuestion: null,
  lastSaved: null,
  isLoaded: false,
  isTransitioning: false,
  undoStack: [],
  fontSize: prefs.fontSize,
  darkMode: prefs.darkMode,
  isImporting: false,
  importProgress: '',
  highlightedAnnotation: null,
  filteredNoteIds: null,

  initSession: async () => {
    const data = await loadSession()
    if (data) {
      const annotations = data.annotations || []
      const indexes = buildAnnotationIndexes(annotations)
      set({
        notes: data.notes || [],
        annotations,
        annotationsByNote: indexes.byNote,
        annotationsById: indexes.byId,
        currentNoteIndex: data.currentNoteIndex || 0,
        mode: data.mode || 'annotate',
        selectedQuestion: data.selectedQuestion || null,
        isLoaded: true
      })
    } else {
      set({ isLoaded: true })
    }
  },
  
  getAnnotationsForNote: (noteId) => {
    return get().annotationsByNote.get(noteId) || []
  },
  
  getAnnotationById: (id) => {
    return get().annotationsById.get(id)
  },

  setNotes: (notes) => {
    // Set transitioning to prevent render issues during state change
    set({ isTransitioning: true })
    
    // Use requestAnimationFrame to ensure clean render cycle
    requestAnimationFrame(() => {
      set({ 
        notes, 
        currentNoteIndex: 0, 
        filteredNoteIds: null,  // Clear any active filters
        highlightedAnnotation: null,
        isTransitioning: false,
        lastSaved: debouncedSave() 
      })
    })
  },

  addNotes: (newNotes) => {
    if (newNotes.length > 100) {
      // Large import - use transition guard
      set({ isTransitioning: true })
      requestAnimationFrame(() => {
        set(s => ({ 
          notes: [...s.notes, ...newNotes], 
          isTransitioning: false,
          lastSaved: debouncedSave() 
        }))
      })
    } else {
      // Small import - do directly
      set(s => ({ notes: [...s.notes, ...newNotes], lastSaved: debouncedSave() }))
    }
  },

  addAnnotation: (ann) => {
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const annotation: Annotation = {
      ...ann,
      id,
      createdAt: Date.now(),
      source: ann.source || 'manual'
    }
    
    // Queue annotation for batched processing
    pendingAnnotations.push(annotation)
    
    // Schedule batch flush (coalesces rapid annotations into single update)
    if (!batchTimeout) {
      batchTimeout = setTimeout(flushAnnotationBatch, BATCH_DELAY_MS)
    }
  },

  addBulkAnnotations: (anns) => {
    const newAnnotations: Annotation[] = anns.map((ann, i) => ({
      ...ann,
      id: `ann_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      source: 'suggested' as const
    }))
    set(s => {
      const allAnnotations = [...s.annotations, ...newAnnotations]
      
      // Incremental index update - O(new) instead of O(all)
      const newByNote = new Map(s.annotationsByNote)
      const newById = new Map(s.annotationsById)
      
      for (const ann of newAnnotations) {
        // Add to byNote
        const existing = newByNote.get(ann.noteId)
        if (existing) {
          newByNote.set(ann.noteId, [...existing, ann])
        } else {
          newByNote.set(ann.noteId, [ann])
        }
        // Add to byId
        newById.set(ann.id, ann)
      }
      
      return { 
        annotations: allAnnotations,
        annotationsByNote: newByNote,
        annotationsById: newById,
        lastSaved: debouncedSave()
      }
    })
  },

  removeAnnotation: (id) => {
    const ann = get().annotationsById.get(id)  // O(1) lookup
    if (ann) {
      set(s => {
        // Incremental index update
        const indexes = removeFromIndexes(id, ann.noteId, s.annotationsByNote, s.annotationsById)
        return { 
          annotations: s.annotations.filter(a => a.id !== id),
          annotationsByNote: indexes.byNote,
          annotationsById: indexes.byId,
          undoStack: [...s.undoStack.slice(-19), { type: 'remove', annotation: ann }],
          lastSaved: debouncedSave()
        }
      })
    }
  },

  updateAnnotation: (id, updates) => {
    const ann = get().annotationsById.get(id)  // O(1) lookup
    if (ann) {
      const updatedAnn = { ...ann, ...updates }
      set(s => {
        // Incremental index update
        const indexes = updateInIndexes(updatedAnn, s.annotationsByNote, s.annotationsById)
        return {
          annotations: s.annotations.map(a => a.id === id ? updatedAnn : a),
          annotationsByNote: indexes.byNote,
          annotationsById: indexes.byId,
          undoStack: [...s.undoStack.slice(-19), { type: 'update', annotation: ann, previousState: updates }],
          lastSaved: debouncedSave()
        }
      })
    }
  },

  setCurrentNoteIndex: (index) => {
    set({ currentNoteIndex: index, lastSaved: debouncedSave() })
  },

  setMode: (mode) => {
    set({ mode, lastSaved: debouncedSave() })
  },

  setSelectedQuestion: (q) => {
    set({ selectedQuestion: q, lastSaved: debouncedSave() })
  },

  clearNoteAnnotations: (noteId) => {
    set(s => {
      const newAnnotations = s.annotations.filter(a => a.noteId !== noteId)
      const indexes = buildAnnotationIndexes(newAnnotations)
      return { 
        annotations: newAnnotations,
        annotationsByNote: indexes.byNote,
        annotationsById: indexes.byId,
        lastSaved: debouncedSave()
      }
    })
  },

  clearAllAnnotations: () => {
    set({ 
      annotations: [], 
      annotationsByNote: new Map(), 
      annotationsById: new Map(),
      lastSaved: debouncedSave()
    })
  },

  clearSuggestedAnnotations: () => {
    set(s => {
      const newAnnotations = s.annotations.filter(a => a.source !== 'suggested')
      const indexes = buildAnnotationIndexes(newAnnotations)
      return { 
        annotations: newAnnotations,
        annotationsByNote: indexes.byNote,
        annotationsById: indexes.byId,
        lastSaved: debouncedSave()
      }
    })
  },

  clearSession: async () => {
    // Set transitioning flag FIRST to prevent components from rendering during transition
    set({ isTransitioning: true })
    
    // Cancel any pending saves to prevent race conditions
    resetSaveState()
    
    // Clear any pending annotation batch
    pendingAnnotations = []
    if (batchTimeout) {
      clearTimeout(batchTimeout)
      batchTimeout = null
    }
    
    // Clear persistent storage (async)
    await clearStorage()
    
    // Use requestAnimationFrame to ensure React has finished any pending renders
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        // Reset ALL state in a single atomic update
        set({
          notes: [],
          annotations: [],
          annotationsByNote: new Map(),
          annotationsById: new Map(),
          currentNoteIndex: 0,
          mode: 'annotate',
          selectedQuestion: null,
          lastSaved: null,
          undoStack: [],
          filteredNoteIds: null,
          highlightedAnnotation: null,
          isImporting: false,
          importProgress: '',
          isLoaded: true,
          isTransitioning: false  // Clear transition flag
        })
        resolve()
      })
    })
  },

  undo: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return

    const action = undoStack[undoStack.length - 1]
    
    if (action.type === 'add') {
      // Undo add = remove (incremental)
      set(s => {
        const indexes = removeFromIndexes(action.annotation.id, action.annotation.noteId, s.annotationsByNote, s.annotationsById)
        return {
          annotations: s.annotations.filter(a => a.id !== action.annotation.id),
          annotationsByNote: indexes.byNote,
          annotationsById: indexes.byId,
          undoStack: s.undoStack.slice(0, -1),
          lastSaved: debouncedSave()
        }
      })
    } else if (action.type === 'remove') {
      // Undo remove = add back (incremental)
      set(s => {
        const indexes = addToIndexes(action.annotation, s.annotationsByNote, s.annotationsById)
        return {
          annotations: [...s.annotations, action.annotation],
          annotationsByNote: indexes.byNote,
          annotationsById: indexes.byId,
          undoStack: s.undoStack.slice(0, -1),
          lastSaved: debouncedSave()
        }
      })
    } else if (action.type === 'update') {
      // Undo update = restore previous state (incremental)
      set(s => {
        const indexes = updateInIndexes(action.annotation, s.annotationsByNote, s.annotationsById)
        return {
          annotations: s.annotations.map(a => a.id === action.annotation.id ? action.annotation : a),
          annotationsByNote: indexes.byNote,
          annotationsById: indexes.byId,
          undoStack: s.undoStack.slice(0, -1),
          lastSaved: debouncedSave()
        }
      })
    }
  },

  setFontSize: (size) => {
    localStorage.setItem('nota_fontSize', size.toString())
    set({ fontSize: size })
  },

  setDarkMode: (dark) => {
    localStorage.setItem('nota_darkMode', dark.toString())
    set({ darkMode: dark })
  },

  setImporting: (importing, progress = '') => {
    set({ isImporting: importing, importProgress: progress })
  },

  setHighlightedAnnotation: (id) => {
    set({ highlightedAnnotation: id })
  },

  setFilteredNoteIds: (ids) => {
    set({ filteredNoteIds: ids })
  }
}))

// Initialize session on module load
useStore.getState().initSession()
