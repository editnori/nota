import { create } from 'zustand'
import type { Note, Annotation, Mode } from '../lib/types'

const STORAGE_KEY = 'annotator_session'

interface State {
  notes: Note[]
  annotations: Annotation[]
  currentNoteIndex: number
  mode: Mode
  selectedQuestion: string | null
  lastSaved: number | null
  
  setNotes: (notes: Note[]) => void
  addNotes: (notes: Note[]) => void
  addAnnotation: (ann: Omit<Annotation, 'id' | 'createdAt'>) => void
  removeAnnotation: (id: string) => void
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void
  setCurrentNoteIndex: (index: number) => void
  setMode: (mode: Mode) => void
  setSelectedQuestion: (q: string | null) => void
  clearSession: () => void
}

function loadSession(): Partial<State> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      return {
        notes: data.notes || [],
        annotations: data.annotations || [],
        currentNoteIndex: data.currentNoteIndex || 0,
        mode: data.mode || 'annotate',
        selectedQuestion: data.selectedQuestion || null
      }
    }
  } catch {
    // ignore
  }
  return {}
}

function saveSession(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      notes: state.notes,
      annotations: state.annotations,
      currentNoteIndex: state.currentNoteIndex,
      mode: state.mode,
      selectedQuestion: state.selectedQuestion
    }))
    return Date.now()
  } catch {
    return null
  }
}

const initial = loadSession()

export const useStore = create<State>((set, get) => ({
  notes: initial.notes || [],
  annotations: initial.annotations || [],
  currentNoteIndex: initial.currentNoteIndex || 0,
  mode: initial.mode || 'annotate',
  selectedQuestion: initial.selectedQuestion || null,
  lastSaved: null,

  setNotes: (notes) => {
    set({ notes, currentNoteIndex: 0 })
    const ts = saveSession(get())
    set({ lastSaved: ts })
  },

  addNotes: (newNotes) => {
    set(s => ({ notes: [...s.notes, ...newNotes] }))
    const ts = saveSession(get())
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
    const ts = saveSession(get())
    set({ lastSaved: ts })
  },

  removeAnnotation: (id) => {
    set(s => ({ annotations: s.annotations.filter(a => a.id !== id) }))
    const ts = saveSession(get())
    set({ lastSaved: ts })
  },

  updateAnnotation: (id, updates) => {
    set(s => ({
      annotations: s.annotations.map(a => a.id === id ? { ...a, ...updates } : a)
    }))
    const ts = saveSession(get())
    set({ lastSaved: ts })
  },

  setCurrentNoteIndex: (index) => {
    set({ currentNoteIndex: index })
    const ts = saveSession(get())
    set({ lastSaved: ts })
  },

  setMode: (mode) => {
    set({ mode })
    const ts = saveSession(get())
    set({ lastSaved: ts })
  },

  setSelectedQuestion: (q) => {
    set({ selectedQuestion: q })
    const ts = saveSession(get())
    set({ lastSaved: ts })
  },

  clearSession: () => {
    localStorage.removeItem(STORAGE_KEY)
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
