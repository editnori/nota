import { useState, useMemo } from 'react'
import { X, Search, Zap, Tag, ChevronRight } from 'lucide-react'
import type { Note } from '../lib/types'

// Common medical negation patterns
const NEGATION_PATTERNS = ['no ', 'not ', 'denies ', 'negative for ', 'without ', 'absent ']

// Ryan's 10 research questions
const DEFAULT_PRESETS: Preset[] = [
  { id: 'q1', name: 'Symptoms', terms: ['flank pain', 'hematuria', 'gross hematuria', 'bloody urine'], checkNegation: true },
  { id: 'q2', name: 'Stone Growth', terms: ['interval stone growth', 'stones are growing', 'increased stone burden'], checkNegation: false },
  { id: 'q3', name: 'Rare Disease', terms: ['cystinuria', 'cystine', 'primary hyperoxaluria'], checkNegation: false },
  { id: 'q4', name: 'SDOH', terms: ['homeless', 'housing', 'unemployment', 'uninsured'], checkNegation: false },
  { id: 'q5', name: 'Equipment', terms: [' Fr', 'french', 'percuflex', 'nitinol', 'basket', 'stent'], checkNegation: false },
  { id: 'q6', name: 'Radiology', terms: ['mm', 'cm', 'hydronephrosis', 'hydroureter', 'nonobstructing'], checkNegation: false },
  { id: 'q7', name: 'Dietary', terms: ['water intake', 'sodium', 'oxalate', 'fluid intake', 'spinach'], checkNegation: false },
  { id: 'q8', name: 'ER Visit', terms: ['emergency department', 'ED ', 'ER ', 'passing a stone', 'renal colic'], checkNegation: false },
  { id: 'q9', name: 'Complications', terms: ['complication', 'readmit', 'infection', 'fever', 'sepsis'], checkNegation: false },
  { id: 'q10', name: 'Stone Passage', terms: ['passed a stone', 'passed stone', 'saw a stone pass'], checkNegation: false },
]

interface Preset {
  id: string
  name: string
  terms: string[]
  checkNegation: boolean
}

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
  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      const saved = localStorage.getItem('nota_presets_v2')
      return saved ? JSON.parse(saved) : DEFAULT_PRESETS
    } catch { return DEFAULT_PRESETS }
  })
  
  const [active, setActive] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [exclude, setExclude] = useState('')
  const [minLen, setMinLen] = useState('')
  const [autoTag, setAutoTag] = useState(false)

  const excludeTerms = exclude.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  const minLength = parseInt(minLen) || 0

  // Get all active terms
  const activeTerms = useMemo(() => {
    const terms: { term: string; checkNegation: boolean }[] = []
    for (const id of active) {
      const p = presets.find(x => x.id === id)
      if (p) p.terms.forEach(t => terms.push({ term: t, checkNegation: p.checkNegation }))
    }
    return terms
  }, [active, presets])

  // Find matches
  const { matchingNotes, matches } = useMemo(() => {
    if (activeTerms.length === 0 && excludeTerms.length === 0 && minLength === 0) {
      return { matchingNotes: new Set(notes.map(n => n.id)), matches: [] }
    }

    const matching = new Set<string>()
    const allMatches: Match[] = []

    for (const note of notes) {
      if (minLength && note.text.length < minLength) continue
      
      const lower = note.text.toLowerCase()
      
      // Check excludes
      if (excludeTerms.some(ex => lower.includes(ex))) continue
      
      // Check includes
      if (activeTerms.length > 0) {
        let found = false
        
        for (const { term, checkNegation } of activeTerms) {
          const termLower = term.toLowerCase()
          let idx = lower.indexOf(termLower)
          
          while (idx !== -1) {
            // Check for negation if enabled
            let negated = false
            if (checkNegation) {
              const before = lower.slice(Math.max(0, idx - 20), idx)
              negated = NEGATION_PATTERNS.some(neg => before.includes(neg))
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
        
        if (!found) continue
      }
      
      matching.add(note.id)
    }

    return { matchingNotes: matching, matches: allMatches }
  }, [notes, activeTerms, excludeTerms, minLength])

  function toggle(id: string) {
    const next = new Set(active)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setActive(next)
  }

  function expand(id: string) {
    if (expanded === id) {
      setExpanded(null)
    } else {
      setExpanded(id)
      const p = presets.find(x => x.id === id)
      setEditValue(p?.terms.join(', ') || '')
    }
  }

  function saveTerms(id: string) {
    const terms = editValue.split(',').map(t => t.trim()).filter(Boolean)
    const updated = presets.map(p => p.id === id ? { ...p, terms } : p)
    setPresets(updated)
    localStorage.setItem('nota_presets_v2', JSON.stringify(updated))
    setExpanded(null)
  }

  function toggleNegation(id: string) {
    const updated = presets.map(p => p.id === id ? { ...p, checkNegation: !p.checkNegation } : p)
    setPresets(updated)
    localStorage.setItem('nota_presets_v2', JSON.stringify(updated))
  }

  function reset() {
    setPresets(DEFAULT_PRESETS)
    localStorage.removeItem('nota_presets_v2')
    setActive(new Set())
    setExclude('')
    setMinLen('')
  }

  function apply() {
    onApply(matchingNotes, autoTag ? matches : undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-maple-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between px-4 py-2 border-b border-maple-200 dark:border-maple-700">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-maple-500" />
            <span className="text-sm font-medium text-maple-700 dark:text-maple-200">Smart Filter</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={reset} className="text-[10px] text-maple-400 hover:text-maple-600">Reset</button>
            <button onClick={onClose}><X size={16} className="text-maple-400" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {presets.map(p => (
            <div key={p.id} className="mb-1">
              <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-maple-50 dark:hover:bg-maple-700/50">
                <button
                  onClick={() => toggle(p.id)}
                  className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                    active.has(p.id) 
                      ? 'bg-maple-700 border-maple-700 text-white' 
                      : 'border-maple-300 dark:border-maple-600'
                  }`}
                >
                  {active.has(p.id) && '✓'}
                </button>
                
                <button 
                  onClick={() => toggle(p.id)}
                  className="flex-1 text-left text-[11px] font-medium text-maple-700 dark:text-maple-200"
                >
                  {p.name}
                </button>
                
                {p.checkNegation && (
                  <span className="text-[8px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded">
                    negation
                  </span>
                )}
                
                <button onClick={() => expand(p.id)} className="text-maple-400 hover:text-maple-600">
                  <ChevronRight size={12} className={`transition-transform ${expanded === p.id ? 'rotate-90' : ''}`} />
                </button>
              </div>
              
              {expanded === p.id && (
                <div className="ml-6 mr-2 mb-2 p-2 bg-maple-50 dark:bg-maple-700/50 rounded text-[10px]">
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    rows={2}
                    placeholder="comma-separated terms"
                    className="w-full px-2 py-1 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded text-[10px] dark:text-maple-200"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={p.checkNegation}
                        onChange={() => toggleNegation(p.id)}
                        className="rounded border-maple-300 text-maple-600 w-3 h-3"
                      />
                      <span className="text-maple-500">Skip negated (no, denies, without)</span>
                    </label>
                    <button 
                      onClick={() => saveTerms(p.id)}
                      className="px-2 py-0.5 bg-maple-700 text-white rounded text-[9px]"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
              
              {active.has(p.id) && expanded !== p.id && (
                <div className="ml-6 mr-2 flex flex-wrap gap-1 pb-1">
                  {p.terms.slice(0, 4).map((t, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[9px] bg-maple-100 dark:bg-maple-700 text-maple-600 dark:text-maple-300 rounded">
                      {t}
                    </span>
                  ))}
                  {p.terms.length > 4 && (
                    <span className="text-[9px] text-maple-400">+{p.terms.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-3 py-2 border-t border-maple-100 dark:border-maple-700 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                value={exclude}
                onChange={e => setExclude(e.target.value)}
                placeholder="Exclude: telephone, template..."
                className="w-full px-2 py-1 text-[10px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
              />
            </div>
            <input
              value={minLen}
              onChange={e => setMinLen(e.target.value)}
              placeholder="Min chars"
              className="w-20 px-2 py-1 text-[10px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
            />
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoTag} onChange={e => setAutoTag(e.target.checked)} className="rounded border-maple-300 text-maple-600" />
            <Tag size={11} className="text-maple-400" />
            <span className="text-[10px] text-maple-600 dark:text-maple-300">Auto-tag matches</span>
          </label>
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t border-maple-200 dark:border-maple-700 bg-maple-50 dark:bg-maple-700/50">
          <span className="text-[11px] text-maple-600 dark:text-maple-300">
            <b>{matchingNotes.size}</b> / {notes.length}
            {autoTag && matches.length > 0 && <span className="text-maple-400"> ({matches.length} tags)</span>}
          </span>
          <button
            onClick={apply}
            disabled={active.size === 0 && !exclude && !minLen}
            className="flex items-center gap-1 px-3 py-1 text-[11px] bg-maple-700 text-white rounded disabled:opacity-40"
          >
            <Search size={11} /> Apply
          </button>
        </div>
      </div>
    </div>
  )
}
