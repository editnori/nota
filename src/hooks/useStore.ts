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
}

// Build annotation index by noteId
function buildAnnotationIndex(annotations: Annotation[]): Map<string, Annotation[]> {
  const index = new Map<string, Annotation[]>()
  for (const ann of annotations) {
    const existing = index.get(ann.noteId)
    if (existing) {
      existing.push(ann)
    } else {
      index.set(ann.noteId, [ann])
    }
  }
  return index
}

// Debounced save to avoid too many writes
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let isBulkOperation = false
let isSaving = false

function debouncedSave(state: State) {
  // Skip saving during bulk operations or if already saving
  if (isBulkOperation || isSaving) return Date.now()
  
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    // Use requestIdleCallback if available to avoid blocking UI
    const doSave = async () => {
      if (isSaving) return
      isSaving = true
      try {
        await saveSession({
          notes: state.notes,
          annotations: state.annotations,
          currentNoteIndex: state.currentNoteIndex,
          mode: state.mode,
          selectedQuestion: state.selectedQuestion
        })
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
    const state = useStore.getState()
    debouncedSave(state)
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
      set({
        notes: data.notes || [],
        annotations,
        annotationsByNote: buildAnnotationIndex(annotations),
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

  setNotes: (notes) => {
    set({ notes, currentNoteIndex: 0 })
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  addNotes: (newNotes) => {
    set(s => ({ notes: [...s.notes, ...newNotes] }))
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
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
      return { 
        annotations: newAnnotations,
        annotationsByNote: buildAnnotationIndex(newAnnotations),
        undoStack: [...s.undoStack.slice(-19), { type: 'add', annotation }]
      }
    })
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
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
      return { 
        annotations: allAnnotations,
        annotationsByNote: buildAnnotationIndex(allAnnotations)
      }
    })
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  removeAnnotation: (id) => {
    const ann = get().annotations.find(a => a.id === id)
    if (ann) {
      set(s => {
        const newAnnotations = s.annotations.filter(a => a.id !== id)
        return { 
          annotations: newAnnotations,
          annotationsByNote: buildAnnotationIndex(newAnnotations),
          undoStack: [...s.undoStack.slice(-19), { type: 'remove', annotation: ann }]
        }
      })
      const ts = debouncedSave(get())
      set({ lastSaved: ts })
    }
  },

  updateAnnotation: (id, updates) => {
    const ann = get().annotations.find(a => a.id === id)
    if (ann) {
      set(s => {
        const newAnnotations = s.annotations.map(a => a.id === id ? { ...a, ...updates } : a)
        return {
          annotations: newAnnotations,
          annotationsByNote: buildAnnotationIndex(newAnnotations),
          undoStack: [...s.undoStack.slice(-19), { type: 'update', annotation: ann, previousState: updates }]
        }
      })
      const ts = debouncedSave(get())
      set({ lastSaved: ts })
    }
  },

  setCurrentNoteIndex: (index) => {
    set({ currentNoteIndex: index })
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  setMode: (mode) => {
    set({ mode })
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  setSelectedQuestion: (q) => {
    set({ selectedQuestion: q })
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  clearNoteAnnotations: (noteId) => {
    set(s => {
      const newAnnotations = s.annotations.filter(a => a.noteId !== noteId)
      return { 
        annotations: newAnnotations,
        annotationsByNote: buildAnnotationIndex(newAnnotations)
      }
    })
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  clearAllAnnotations: () => {
    set({ annotations: [], annotationsByNote: new Map() })
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  clearSuggestedAnnotations: () => {
    set(s => {
      const newAnnotations = s.annotations.filter(a => a.source !== 'suggested')
      return { 
        annotations: newAnnotations,
        annotationsByNote: buildAnnotationIndex(newAnnotations)
      }
    })
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  clearSession: async () => {
    await clearStorage()
    set({
      notes: [],
      annotations: [],
      annotationsByNote: new Map(),
      currentNoteIndex: 0,
      mode: 'annotate',
      selectedQuestion: null,
      lastSaved: null,
      undoStack: []
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
        return {
          annotations: newAnnotations,
          annotationsByNote: buildAnnotationIndex(newAnnotations),
          undoStack: s.undoStack.slice(0, -1)
        }
      })
    } else if (action.type === 'remove') {
      // Undo remove = add back
      set(s => {
        const newAnnotations = [...s.annotations, action.annotation]
        return {
          annotations: newAnnotations,
          annotationsByNote: buildAnnotationIndex(newAnnotations),
          undoStack: s.undoStack.slice(0, -1)
        }
      })
    } else if (action.type === 'update') {
      // Undo update = restore previous state
      set(s => {
        const newAnnotations = s.annotations.map(a => 
          a.id === action.annotation.id ? action.annotation : a
        )
        return {
          annotations: newAnnotations,
          annotationsByNote: buildAnnotationIndex(newAnnotations),
          undoStack: s.undoStack.slice(0, -1)
        }
      })
    }
    
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
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
