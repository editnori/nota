import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// Provide minimal browser globals before importing the store
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key]
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {}
  }),
  key: vi.fn((index: number) => Object.keys(localStorageMock.store)[index] ?? null),
  get length() {
    return Object.keys(localStorageMock.store).length
  },
}

// Vitest runs in node; stub only what the store touches
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true })
Object.defineProperty(global, 'window', { 
  value: {
    requestIdleCallback: (cb: IdleRequestCallback) => { cb({ didTimeout: false, timeRemaining: () => 5 } as IdleDeadline); return 1 },
  }, 
  writable: true 
})
Object.defineProperty(global, 'requestAnimationFrame', { 
  value: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0), 
  writable: true 
})

// Mock persistence layer to avoid touching real storage/tauri in tests
vi.mock('../lib/storage', () => ({
  loadSession: vi.fn().mockResolvedValue(null),
  saveSession: vi.fn().mockResolvedValue(true),
  clearStorage: vi.fn().mockResolvedValue(undefined),
}))

import { useStore, buildAnnotationIndexes } from '../hooks/useStore'
import type { Annotation } from '../lib/types'

function resetStore() {
  useStore.setState({
    notes: [],
    annotations: [],
    annotationsByNote: new Map(),
    annotationsById: new Map(),
    currentNoteIndex: 0,
    mode: 'annotate',
    selectedQuestion: null,
    lastSaved: null,
    isLoaded: true,
    isTransitioning: false,
    undoStack: [],
    fontSize: 13,
    darkMode: false,
    formatterMode: 'model',
    isImporting: false,
    importProgress: '',
    highlightedAnnotation: null,
    filteredNoteIds: null,
    pendingImport: null,
  })
}

describe('useStore core behaviors', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetStore()
    localStorageMock.clear()
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds an annotation in a batched flush and keeps indexes in sync', async () => {
    const { addAnnotation } = useStore.getState()

    useStore.setState({ notes: [{ id: 'n1', text: 'hello' }] })

    addAnnotation({
      noteId: 'n1',
      start: 0,
      end: 5,
      text: 'hello',
      questions: ['Q1'],
      source: 'manual',
    })

    // Let the async batch flush run
    await vi.advanceTimersByTimeAsync(50)

    const state = useStore.getState()
    expect(state.annotations).toHaveLength(1)
    const ann = state.annotations[0]
    expect(ann.noteId).toBe('n1')
    expect(state.annotationsByNote.get('n1')?.[0]?.id).toBe(ann.id)
    expect(state.annotationsById.get(ann.id)?.text).toBe('hello')
  })

  it('removes and restores via undo, keeping indexes accurate', () => {
    const noteId = 'n2'
    const baseAnn: Annotation = {
      id: 'ann_1',
      noteId,
      start: 0,
      end: 3,
      text: 'abc',
      questions: ['Q1'],
      source: 'manual',
      createdAt: Date.now(),
    }
    resetStore()
    useStore.setState({
      notes: [{ id: noteId, text: 'abc' }],
      annotations: [baseAnn],
      annotationsByNote: new Map([[noteId, [baseAnn]]]),
      annotationsById: new Map([[baseAnn.id, baseAnn]]),
    })

    const { removeAnnotation, undo } = useStore.getState()
    removeAnnotation(baseAnn.id)

    let state = useStore.getState()
    expect(state.annotations).toHaveLength(0)
    expect(state.annotationsByNote.has(noteId)).toBe(false)
    expect(state.annotationsById.has(baseAnn.id)).toBe(false)
    expect(state.undoStack[state.undoStack.length - 1]?.type).toBe('remove')

    undo()
    state = useStore.getState()
    expect(state.annotations).toHaveLength(1)
    expect(state.annotationsById.has(baseAnn.id)).toBe(true)
    expect(state.annotationsByNote.get(noteId)?.[0]?.id).toBe(baseAnn.id)
  })

  it('clears only suggested annotations', async () => {
    const manual: Annotation = {
      id: 'ann_m',
      noteId: 'n3',
      start: 0,
      end: 4,
      text: 'note',
      questions: ['Q1'],
      source: 'manual',
      createdAt: Date.now(),
    }
    const suggested: Annotation = {
      ...manual,
      id: 'ann_s',
      source: 'suggested',
    }
    resetStore()
    useStore.setState({
      notes: [{ id: 'n3', text: 'note' }],
      annotations: [manual, suggested],
      annotationsByNote: new Map([['n3', [manual, suggested]]]),
      annotationsById: new Map([
        [manual.id, manual],
        [suggested.id, suggested],
      ]),
    })

    useStore.getState().clearSuggestedAnnotations()
    await vi.advanceTimersByTimeAsync(50)

    const state = useStore.getState()
    expect(state.annotations).toHaveLength(1)
    expect(state.annotations[0].id).toBe('ann_m')
    expect(state.annotationsByNote.get('n3')).toHaveLength(1)
    expect(state.annotationsById.has('ann_s')).toBe(false)
  })

  it('persists formatter mode changes to localStorage', () => {
    resetStore()
    useStore.getState().setFormatterMode('regex')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('nota_formatterMode', 'regex')
    expect(useStore.getState().formatterMode).toBe('regex')
  })

  it('buildAnnotationIndexes returns note and id maps', () => {
    const anns: Annotation[] = [
      { id: 'a1', noteId: 'n1', start: 0, end: 1, text: 'a', questions: ['Q1'], source: 'manual', createdAt: 1 },
      { id: 'a2', noteId: 'n2', start: 0, end: 1, text: 'b', questions: ['Q1'], source: 'manual', createdAt: 1 },
    ]
    const { byNote, byId } = buildAnnotationIndexes(anns)
    expect(byNote.get('n1')?.[0]?.id).toBe('a1')
    expect(byNote.get('n2')?.[0]?.id).toBe('a2')
    expect(byId.get('a1')?.noteId).toBe('n1')
    expect(byId.get('a2')?.noteId).toBe('n2')
  })
})
