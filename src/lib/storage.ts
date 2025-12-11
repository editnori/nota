// Persistent storage abstraction
// Uses Tauri store in desktop app, localStorage in browser

import type { Note, Annotation, Mode } from './types'
import { isTauri } from './platform'

const STORAGE_KEY = 'nota_session'

interface SessionData {
  notes: Note[]
  annotations: Annotation[]
  currentNoteIndex: number
  mode: Mode
  selectedQuestion: string | null
}

let tauriStore: any = null

async function getTauriStore() {
  if (tauriStore) return tauriStore
  
  try {
    const { load } = await import('@tauri-apps/plugin-store')
    tauriStore = await load('nota-session.json')
    return tauriStore
  } catch (err) {
    console.error('Failed to load Tauri store:', err)
    return null
  }
}

export async function loadSession(): Promise<SessionData | null> {
  if (isTauri()) {
    try {
      const store = await getTauriStore()
      if (store) {
        const data = await store.get(STORAGE_KEY) as SessionData | null
        if (data) {
          return data
        }
      }
    } catch (err) {
      console.error('Tauri load error:', err)
    }
  }
  
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch {
    // ignore
  }
  
  return null
}

export async function saveSession(data: SessionData): Promise<boolean> {
  if (isTauri()) {
    try {
      const store = await getTauriStore()
      if (store) {
        await store.set(STORAGE_KEY, data)
        await store.save()
        return true
      }
    } catch (err) {
      console.error('Tauri save error:', err)
    }
  }
  
  // Fallback to localStorage - use requestIdleCallback for non-blocking serialization
  return new Promise((resolve) => {
    const doSave = () => {
      try {
        const json = JSON.stringify(data)
        localStorage.setItem(STORAGE_KEY, json)
        resolve(true)
      } catch {
        resolve(false)
      }
    }
    
    // Use requestIdleCallback if available to avoid blocking UI during heavy serialization
    // This is especially important for large datasets (10k+ notes, 50k+ annotations)
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(doSave, { timeout: 5000 })
    } else {
      // Fallback: use setTimeout to at least yield to event loop
      setTimeout(doSave, 0)
    }
  })
}

export async function clearStorage(): Promise<void> {
  if (isTauri()) {
    try {
      const store = await getTauriStore()
      if (store) {
        await store.delete(STORAGE_KEY)
        await store.save()
      }
    } catch (err) {
      console.error('Tauri clear error:', err)
    }
  }
  
  // Also clear localStorage
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
