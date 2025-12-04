import { useState, useMemo } from 'react'
import { X, Search, ChevronDown, Filter, Ban } from 'lucide-react'
import { loadQuestions } from '../lib/questions'
import type { Note } from '../lib/types'

// Search patterns for each question - based on Ryan's clinical feedback
const QUESTION_PATTERNS: Record<string, { terms: string[]; patterns?: RegExp[]; negation?: boolean }> = {
  Q1: { // Symptoms
    terms: ['flank pain', 'hematuria', 'gross hematuria', 'bloody urine', 'renal colic', 'dysuria'],
    negation: true // Skip "no hematuria", "denies pain"
  },
  Q2: { // Progression
    terms: ['interval stone growth', 'stones are growing', 'increased stone burden', 'stone enlargement', 'progression'],
    negation: false
  },
  Q3: { // Rare Disease
    terms: ['cystinuria', 'cystine', 'primary hyperoxaluria', 'hyperoxaluria', 'staghorn'],
    negation: false
  },
  Q4: { // SDOH
    terms: ['homeless', 'housing', 'unemploy', 'uninsured', 'transportation', 'social support', 'lives alone'],
    negation: false
  },
  Q5: { // Devices - from Ryan's operative note feedback
    terms: ['percuflex', 'boston scientific', 'nitinol basket', 'laser fiber', 'access sheath', 'guidewire', 'foley catheter', 'ureteral catheter'],
    patterns: [/\d+\s*fr\b/i, /\d+\s*french/i, /\d+x\d+\s*(stent|catheter)?/i, /\d+\.\d+x\d+/i] // 5Fr, 20 French, 7x30, 4.8x26
  },
  Q6: { // Radiology - measurements and findings
    terms: ['hydronephrosis', 'hydroureter', 'nonobstructing', 'calculi', 'calcification', 'stone burden', 'renal cyst'],
    patterns: [/\d+\s*mm\b/i, /\d+\s*cm\b/i, /\d+\s*x\s*\d+\s*(x\s*\d+)?/i, /mgy\s*cm/i, /bosniack\s*\d/i] // 5mm, 9.7cm, 5x2x4, mGycm, Bosniack 2
  },
  Q7: { // Diet Advice
    terms: ['water intake', 'fluid intake', 'low sodium', 'low oxalate', 'dietary', 'spinach', 'litholink'],
    negation: false
  },
  Q8: { // ER Visit
    terms: ['emergency department', 'emergency room', 'ED visit', 'ER visit', 'acute presentation', 'presented to'],
    negation: false
  },
  Q9: { // Post-op Complication
    terms: ['complication', 'readmit', 'readmission', 'post-operative', 'postoperative', 'infection', 'sepsis', 'fever', 'came back'],
    negation: false
  },
  Q10: { // Stone Passage
    terms: ['passed a stone', 'passed stone', 'saw a stone pass', 'stone passed', 'spontaneous passage'],
    negation: false
  }
}

// Note types to EXCLUDE - from Ryan's feedback about irrelevant notes
const EXCLUDE_PRESETS = [
  { id: 'telephone', label: 'Telephone notes', terms: ['telephone', 'phone call', 'phone note'] },
  { id: 'pt_ot', label: 'PT/OT notes', terms: ['physical therapy', 'occupational therapy'] },
  { id: 'anesthesia', label: 'Anesthesia preop', terms: ['anesthesia preoperative', 'preoperative evaluation'] },
  { id: 'short', label: 'Very short (<200 chars)', terms: [], minLength: 200 },
]

const NEGATION_PATTERNS = ['no ', 'not ', 'denies ', 'denied ', 'negative for ', 'without ', 'absent ', 'none ']

interface Match {
  noteId: string
  term: string
  start: number
  end: number
}

interface Props {
  notes: Note[]
  onApply: (noteIds: Set<string>, matches?: Match[]) => void
  onClose: () => void
}

export function SmartFilter({ notes, onApply, onClose }: Props) {
  const questions = loadQuestions()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [excludes, setExcludes] = useState<Set<string>>(new Set())
  const [customExclude, setCustomExclude] = useState('')
  const [showExcludes, setShowExcludes] = useState(false)
  const [autoTag, setAutoTag] = useState(false)

  // Calculate matches
  const { matchingNotes, matches, excludedCount } = useMemo(() => {
    const matching = new Set<string>()
    const allMatches: Match[] = []
    let excluded = 0

    // Build exclude terms list
    const excludeTerms = customExclude.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    for (const ex of excludes) {
      const preset = EXCLUDE_PRESETS.find(p => p.id === ex)
      if (preset) excludeTerms.push(...preset.terms.map(t => t.toLowerCase()))
    }
    const minLength = excludes.has('short') ? 200 : 0

    for (const note of notes) {
      const lower = note.text.toLowerCase()
      
      // Check excludes
      if (minLength && note.text.length < minLength) { excluded++; continue }
      if (excludeTerms.some(ex => lower.includes(ex))) { excluded++; continue }

      // If no questions selected, show all (minus excludes)
      if (selected.size === 0) {
        matching.add(note.id)
        continue
      }

      // Check selected questions
      let found = false
      for (const qid of selected) {
        const config = QUESTION_PATTERNS[qid]
        if (!config) continue

        // Check terms
        for (const term of config.terms) {
          const termLower = term.toLowerCase()
          let idx = lower.indexOf(termLower)
          
          while (idx !== -1) {
            // Check negation if enabled
            let negated = false
            if (config.negation) {
              const before = lower.slice(Math.max(0, idx - 15), idx)
              negated = NEGATION_PATTERNS.some(neg => before.endsWith(neg))
            }
            
            if (!negated) {
              found = true
              allMatches.push({
                noteId: note.id,
                term: note.text.slice(idx, idx + term.length),
                start: idx,
                end: idx + term.length
              })
            }
            idx = lower.indexOf(termLower, idx + 1)
          }
        }

        // Check regex patterns
        if (config.patterns) {
          for (const pattern of config.patterns) {
            const matches = note.text.matchAll(new RegExp(pattern, 'gi'))
            for (const m of matches) {
              if (m.index !== undefined) {
                found = true
                allMatches.push({
                  noteId: note.id,
                  term: m[0],
                  start: m.index,
                  end: m.index + m[0].length
                })
              }
            }
          }
        }
      }

      if (found) matching.add(note.id)
    }

    return { matchingNotes: matching, matches: allMatches, excludedCount: excluded }
  }, [notes, selected, excludes, customExclude])

  function toggle(qid: string) {
    const next = new Set(selected)
    if (next.has(qid)) next.delete(qid)
    else next.add(qid)
    setSelected(next)
  }

  function toggleExclude(id: string) {
    const next = new Set(excludes)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExcludes(next)
  }

  function apply() {
    onApply(matchingNotes, autoTag ? matches : undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-maple-800 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-maple-200 dark:border-maple-700">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-maple-500" />
            <span className="text-sm font-medium text-maple-700 dark:text-maple-200">Find Notes by Question</span>
          </div>
          <button onClick={onClose}><X size={18} className="text-maple-400 hover:text-maple-600" /></button>
        </div>

        {/* Questions - styled like QuestionPicker */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-[10px] uppercase tracking-wide text-maple-500 dark:text-maple-400 mb-2">
            Select questions to find relevant notes
          </div>
          
          <div className="space-y-1.5">
            {questions.map(q => {
              const isActive = selected.has(q.id)
              const config = QUESTION_PATTERNS[q.id]
              
              return (
                <button
                  key={q.id}
                  onClick={() => toggle(q.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                    isActive ? 'ring-2 ring-offset-1 dark:ring-offset-maple-800' : 'hover:bg-maple-50 dark:hover:bg-maple-700'
                  }`}
                  style={{
                    backgroundColor: isActive ? `${q.color}15` : undefined,
                    // @ts-expect-error
                    '--tw-ring-color': isActive ? q.color : undefined
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shadow-sm"
                    style={{ backgroundColor: q.color }}
                  >
                    {q.hotkey}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium" style={{ color: isActive ? q.color : undefined }}>
                      <span className={isActive ? '' : 'text-maple-700 dark:text-maple-200'}>{q.name}</span>
                    </div>
                    <div className="text-[10px] text-maple-400 dark:text-maple-500 truncate">
                      {config?.terms.slice(0, 3).join(', ')}
                      {config?.patterns && ' + patterns'}
                    </div>
                  </div>
                  {isActive && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: q.color }}>
                      on
                    </span>
                  )}
                  {config?.negation && (
                    <span className="text-[8px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded">neg</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Exclude section */}
          <button 
            onClick={() => setShowExcludes(!showExcludes)}
            className="w-full flex items-center gap-2 mt-4 px-2 py-1.5 text-[11px] text-maple-500 dark:text-maple-400 hover:text-maple-700"
          >
            <Ban size={12} />
            <span>Exclude irrelevant notes</span>
            <ChevronDown size={12} className={`ml-auto transition-transform ${showExcludes ? 'rotate-180' : ''}`} />
          </button>

          {showExcludes && (
            <div className="mt-2 p-2 bg-maple-50 dark:bg-maple-700/50 rounded-lg space-y-2">
              {EXCLUDE_PRESETS.map(preset => (
                <label key={preset.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludes.has(preset.id)}
                    onChange={() => toggleExclude(preset.id)}
                    className="rounded border-maple-300 text-red-600 w-3.5 h-3.5"
                  />
                  <span className="text-[11px] text-maple-600 dark:text-maple-300">{preset.label}</span>
                </label>
              ))}
              <input
                value={customExclude}
                onChange={e => setCustomExclude(e.target.value)}
                placeholder="Other exclusions (comma-separated)"
                className="w-full px-2 py-1 text-[10px] bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
              />
            </div>
          )}
        </div>

        {/* Auto-tag option */}
        <div className="px-4 py-2 border-t border-maple-100 dark:border-maple-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoTag}
              onChange={e => setAutoTag(e.target.checked)}
              className="rounded border-maple-300 text-maple-600"
            />
            <span className="text-[10px] text-maple-600 dark:text-maple-300">Auto-tag matched phrases as suggestions</span>
            {autoTag && matches.length > 0 && (
              <span className="text-[9px] text-maple-400">({matches.length} matches)</span>
            )}
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-maple-200 dark:border-maple-700 bg-maple-50 dark:bg-maple-700/50">
          <div className="text-[11px]">
            <span className="font-semibold text-maple-700 dark:text-maple-200">{matchingNotes.size}</span>
            <span className="text-maple-500 dark:text-maple-400"> notes</span>
            {excludedCount > 0 && (
              <span className="text-maple-400 dark:text-maple-500"> ({excludedCount} excluded)</span>
            )}
          </div>
          <button
            onClick={apply}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-maple-700 dark:bg-maple-600 text-white rounded hover:bg-maple-600"
          >
            <Search size={12} /> Apply
          </button>
        </div>
      </div>
    </div>
  )
}
