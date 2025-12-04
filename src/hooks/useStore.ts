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
interface AnnotationIndexes {
  byNote: Map<string, Annotation[]>
  byId: Map<string, Annotation>
}

function buildAnnotationIndexes(annotations: Annotation[]): AnnotationIndexes {
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

// Debounced save to avoid too many writes
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let isBulkOperation = false
let isSaving = false
let lastSavedHash = ''

// Simple hash to detect if data actually changed
function quickHash(notes: Note[], annotations: Annotation[]): string {
  return `${notes.length}-${annotations.length}-${annotations[annotations.length - 1]?.id || ''}`
}

function debouncedSave() {
  // Skip saving during bulk operations or if already saving
  if (isBulkOperation || isSaving) return Date.now()
  
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
      (window as any).requestIdleCallback(doSave, { timeout: 2000 })
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(doSave, 100)
    }
  }, 500) // Increased debounce for large datasets
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
    set({ notes, currentNoteIndex: 0, lastSaved: debouncedSave() })
  },

  addNotes: (newNotes) => {
    set(s => ({ notes: [...s.notes, ...newNotes], lastSaved: debouncedSave() }))
  },

  addAnnotation: (ann) => {
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const annotation: Annotation = {
      ...ann,
      id,
      createdAt: Date.now(),
      source: ann.source || 'manual'
    }
    set(s => {
      const newAnnotations = [...s.annotations, annotation]
      const indexes = buildAnnotationIndexes(newAnnotations)
      return { 
        annotations: newAnnotations,
        annotationsByNote: indexes.byNote,
        annotationsById: indexes.byId,
        undoStack: [...s.undoStack.slice(-19), { type: 'add', annotation }],
        lastSaved: debouncedSave()
      }
    })
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
      const indexes = buildAnnotationIndexes(allAnnotations)
      return { 
        annotations: allAnnotations,
        annotationsByNote: indexes.byNote,
        annotationsById: indexes.byId,
        lastSaved: debouncedSave()
      }
    })
  },

  removeAnnotation: (id) => {
    const ann = get().annotationsById.get(id)  // O(1) lookup
    if (ann) {
      set(s => {
        const newAnnotations = s.annotations.filter(a => a.id !== id)
        const indexes = buildAnnotationIndexes(newAnnotations)
        return { 
          annotations: newAnnotations,
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
      set(s => {
        const newAnnotations = s.annotations.map(a => a.id === id ? { ...a, ...updates } : a)
        const indexes = buildAnnotationIndexes(newAnnotations)
        return {
          annotations: newAnnotations,
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
    await clearStorage()
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
      highlightedAnnotation: null
    })
  },

  undo: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return

    const action = undoStack[undoStack.length - 1]
    
    if (action.type === 'add') {
      // Undo add = remove
      set(s => {
        const newAnnotations = s.annotations.filter(a => a.id !== action.annotation.id)
        const indexes = buildAnnotationIndexes(newAnnotations)
        return {
          annotations: newAnnotations,
          annotationsByNote: indexes.byNote,
          annotationsById: indexes.byId,
          undoStack: s.undoStack.slice(0, -1),
          lastSaved: debouncedSave()
        }
      })
    } else if (action.type === 'remove') {
      // Undo remove = add back
      set(s => {
        const newAnnotations = [...s.annotations, action.annotation]
        const indexes = buildAnnotationIndexes(newAnnotations)
        return {
          annotations: newAnnotations,
          annotationsByNote: indexes.byNote,
          annotationsById: indexes.byId,
          undoStack: s.undoStack.slice(0, -1),
          lastSaved: debouncedSave()
        }
      })
    } else if (action.type === 'update') {
      // Undo update = restore previous state
      set(s => {
        const newAnnotations = s.annotations.map(a => 
          a.id === action.annotation.id ? action.annotation : a
        )
        const indexes = buildAnnotationIndexes(newAnnotations)
        return {
          annotations: newAnnotations,
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
