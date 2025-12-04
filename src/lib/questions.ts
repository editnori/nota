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

export function loadQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(QUESTIONS_STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch {
    // ignore
  }
  return DEFAULT_QUESTIONS
}

export function saveQuestions(questions: Question[]) {
  localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(questions))
}

export function getQuestion(id: string): Question | undefined {
  const questions = loadQuestions()
  return questions.find(q => q.id === id)
}

export function getQuestionByHotkey(key: string): Question | undefined {
  const questions = loadQuestions()
  return questions.find(q => q.hotkey === key)
}
