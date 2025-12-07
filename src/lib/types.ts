export interface Note {
  id: string
  text: string
  meta?: {
    type?: string
    date?: string
    source?: string
    rawText?: string  // Original text before formatting (for comparison)
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

// Formatter modes
export type FormatterMode = 'none' | 'regex' | 'model'

// Section types (matching v4 Python model)
export type SectionType = 
  | 'NONE' | 'HPI' | 'PMH' | 'PSH' | 'SOCIAL' | 'FAMILY' | 'ALLERGIES' | 'MEDS'
  | 'ROS' | 'PE' | 'VITALS' | 'LABS' | 'IMAGING' | 'ASSESSMENT' | 'PLAN' | 'COURSE' | 'OTHER'

// Line types (matching v4 Python model)
export type LineType = 'NARRATIVE' | 'MAJOR_HEADER' | 'MINOR_HEADER' | 'LIST_ITEM' | 'TABLE_ROW'

// BiLSTM model explanation types
export interface TokenExplanation {
  token: string
  decision: 'space' | 'newline' | 'blank_line'
  confidence: number
  reason: string
  probs: {
    space: number
    newline: number
    blank_line: number
  }
  /** Entropy of probability distribution (0=certain, ~1.1=max uncertainty for 3 classes) */
  entropy: number
  /** True if 2nd best option is within 20% of best (ambiguous decision) */
  ambiguous: boolean
  /** Detected line type (MAJOR_HEADER, MINOR_HEADER, LIST_ITEM, etc.) */
  lineType: LineType
  /** Detected section (HPI, PMH, MEDS, etc.) */
  section: SectionType
  /** Whether this token starts a new line */
  isLineStart: boolean
}

export interface FormatExplanation {
  tokens: string[]
  predictions: number[]
  confidences: number[]
  explanation: TokenExplanation[]
  stats: {
    total_tokens: number
    spaces: number
    newlines: number
    blank_lines: number
    avg_confidence: number
    /** Count of detected headers */
    headers: number
    /** Count of list items */
    list_items: number
    /** Sections detected in this note */
    sections_found: SectionType[]
  }
}
