export interface Note {
  id: string
  text: string
  meta?: {
    type?: string
    date?: string
    source?: string
  }
}

export interface Annotation {
  id: string
  noteId: string
  start: number
  end: number
  text: string
  questions: string[]
  comment?: string
  createdAt: number
  source?: 'manual' | 'suggested'  // manual = Ryan's work, suggested = bulk/pattern
}

export interface Question {
  id: string
  name: string
  color: string
  hotkey: string
  hint: string
}

export type Mode = 'annotate' | 'review' | 'format'
