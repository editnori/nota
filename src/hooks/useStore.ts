import { create } from 'zustand'
import type { Note, Annotation, Mode } from '../lib/types'
import { loadSession, saveSession, clearStorage } from '../lib/storage'

interface State {
  notes: Note[]
  annotations: Annotation[]
  currentNoteIndex: number
  mode: Mode
  selectedQuestion: string | null
  lastSaved: number | null
  isLoaded: boolean
  
  setNotes: (notes: Note[]) => void
  addNotes: (notes: Note[]) => void
  addAnnotation: (ann: Omit<Annotation, 'id' | 'createdAt'>) => void
  removeAnnotation: (id: string) => void
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void
  setCurrentNoteIndex: (index: number) => void
  setMode: (mode: Mode) => void
  setSelectedQuestion: (q: string | null) => void
  clearNoteAnnotations: (noteId: string) => void
  clearAllAnnotations: () => void
  clearSession: () => Promise<void>
  initSession: () => Promise<void>
}

// Debounced save to avoid too many writes
let saveTimeout: ReturnType<typeof setTimeout> | null = null

function debouncedSave(state: State) {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    await saveSession({
      notes: state.notes,
      annotations: state.annotations,
      currentNoteIndex: state.currentNoteIndex,
      mode: state.mode,
      selectedQuestion: state.selectedQuestion
    })
  }, 300)
  return Date.now()
}

export const useStore = create<State>((set, get) => ({
  notes: [],
  annotations: [],
  currentNoteIndex: 0,
  mode: 'annotate',
  selectedQuestion: null,
  lastSaved: null,
  isLoaded: false,

  initSession: async () => {
    const data = await loadSession()
    if (data) {
      set({
        notes: data.notes || [],
        annotations: data.annotations || [],
        currentNoteIndex: data.currentNoteIndex || 0,
        mode: data.mode || 'annotate',
        selectedQuestion: data.selectedQuestion || null,
        isLoaded: true
      })
    } else {
      set({ isLoaded: true })
    }
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
      createdAt: Date.now()
    }
    set(s => ({ annotations: [...s.annotations, annotation] }))
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  removeAnnotation: (id) => {
    set(s => ({ annotations: s.annotations.filter(a => a.id !== id) }))
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  updateAnnotation: (id, updates) => {
    set(s => ({
      annotations: s.annotations.map(a => a.id === id ? { ...a, ...updates } : a)
    }))
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
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
    set(s => ({ annotations: s.annotations.filter(a => a.noteId !== noteId) }))
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  clearAllAnnotations: () => {
    set({ annotations: [] })
    const ts = debouncedSave(get())
    set({ lastSaved: ts })
  },

  clearSession: async () => {
    await clearStorage()
    set({
      notes: [],
      annotations: [],
      currentNoteIndex: 0,
      mode: 'annotate',
      selectedQuestion: null,
      lastSaved: null
    })
  }
}))

// Initialize session on module load
useStore.getState().initSession()
