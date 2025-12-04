import type { Question } from './types'

// higher contrast colors that work well on warm backgrounds
export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'Q1',
    name: 'Symptoms',
    color: '#b45309',
    hotkey: '1',
    hint: 'flank pain, hematuria, bloody urine'
  },
  {
    id: 'Q2',
    name: 'Progression',
    color: '#be123c',
    hotkey: '2',
    hint: 'interval stone growth, stones growing'
  },
  {
    id: 'Q3',
    name: 'Rare Disease',
    color: '#7c3aed',
    hotkey: '3',
    hint: 'cystinuria, cystine, primary hyperoxaluria'
  },
  {
    id: 'Q4',
    name: 'SDOH',
    color: '#a21caf',
    hotkey: '4',
    hint: 'housing, transportation, support'
  },
  {
    id: 'Q5',
    name: 'Devices',
    color: '#1d4ed8',
    hotkey: '5',
    hint: 'Fr, French, sheath, laser fiber'
  },
  {
    id: 'Q6',
    name: 'Radiology',
    color: '#0f766e',
    hotkey: '6',
    hint: 'stone size, location, hydronephrosis'
  },
  {
    id: 'Q7',
    name: 'Diet Advice',
    color: '#4d7c0f',
    hotkey: '7',
    hint: 'water, sodium, oxalate, protein'
  },
  {
    id: 'Q8',
    name: 'ER Visit',
    color: '#c2410c',
    hotkey: '8',
    hint: 'ED presentation for stone'
  },
  {
    id: 'Q9',
    name: 'Post-op Complication',
    color: '#b91c1c',
    hotkey: '9',
    hint: 'complication within 30 days'
  },
  {
    id: 'Q10',
    name: 'Stone Passage',
    color: '#4338ca',
    hotkey: '0',
    hint: 'passed stone at home'
  }
]

const QUESTIONS_STORAGE_KEY = 'annotator_questions'

// Cache questions and maps for O(1) lookups
let cachedQuestions: Question[] | null = null
let questionById: Map<string, Question> | null = null
let questionByHotkey: Map<string, Question> | null = null

function invalidateCache() {
  cachedQuestions = null
  questionById = null
  questionByHotkey = null
}

export function loadQuestions(): Question[] {
  if (cachedQuestions) return cachedQuestions
  
  try {
    const raw = localStorage.getItem(QUESTIONS_STORAGE_KEY)
    if (raw) {
      cachedQuestions = JSON.parse(raw)
      return cachedQuestions!
    }
  } catch {
    // ignore
  }
  cachedQuestions = DEFAULT_QUESTIONS
  return cachedQuestions
}

export function saveQuestions(questions: Question[]) {
  localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(questions))
  invalidateCache()
}

// O(1) lookup by id
export function getQuestion(id: string): Question | undefined {
  if (!questionById) {
    questionById = new Map()
    for (const q of loadQuestions()) {
      questionById.set(q.id, q)
    }
  }
  return questionById.get(id)
}

// O(1) lookup by hotkey
export function getQuestionByHotkey(key: string): Question | undefined {
  if (!questionByHotkey) {
    questionByHotkey = new Map()
    for (const q of loadQuestions()) {
      questionByHotkey.set(q.hotkey, q)
    }
  }
  return questionByHotkey.get(key)
}
