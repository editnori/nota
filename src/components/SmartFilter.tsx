import { useState, useMemo } from 'react'
import { X, Plus, Search, Zap, Tag, Pencil, Check } from 'lucide-react'
import type { Note } from '../lib/types'

// Ryan's 10 research questions mapped to filter presets
const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'q1-symptoms',
    name: 'Q1: Symptoms',
    description: 'Symptoms from kidney stone disease',
    terms: ['flank pain', 'hematuria', 'gross hematuria', 'bloody urine']
  },
  {
    id: 'q2-growth',
    name: 'Q2: Stone Growth',
    description: 'Disease progression',
    terms: ['interval stone growth', 'stones are growing', 'stone growth', 'increased stone burden']
  },
  {
    id: 'q3-rare',
    name: 'Q3: Rare Disease',
    description: 'Pre-diagnosis indicators',
    terms: ['cystinuria', 'cystine', 'primary hyperoxaluria']
  },
  {
    id: 'q4-sdoh',
    name: 'Q4: SDOH',
    description: 'Social determinants',
    terms: ['homeless', 'housing', 'employment', 'insurance', 'transportation']
  },
  {
    id: 'q5-devices',
    name: 'Q5: Equipment',
    description: 'Operative note devices',
    terms: [' Fr', 'french', 'percuflex', 'nitinol', 'basket', 'laser', 'stent']
  },
  {
    id: 'q6-radiology',
    name: 'Q6: Radiology',
    description: 'Sizes, obstruction',
    terms: ['3 mm', '3mm', '4 mm', '4mm', '5 mm', '5mm', 'hydronephrosis', 'hydroureter', 'nonobstructing']
  },
  {
    id: 'q7-dietary',
    name: 'Q7: Dietary',
    description: 'Prevention advice',
    terms: ['water', 'soda', 'protein', 'salt', 'sodium', 'oxalate', 'spinach', 'fluid intake']
  },
  {
    id: 'q8-er',
    name: 'Q8: ER Visit',
    description: 'Emergency patterns',
    terms: ['emergency department', 'emergency room', 'ED ', 'ER ', 'passing a stone', 'renal colic']
  },
  {
    id: 'q9-complications',
    name: 'Q9: Complications',
    description: 'Post-surgery (0-30 days)',
    terms: ['complication', 'readmit', 'fever', 'infection', 'sepsis', 'post-operative']
  },
  {
    id: 'q10-passage',
    name: 'Q10: Stone Passage',
    description: 'Passed without care',
    terms: ['passed a stone', 'passed stone', 'saw a stone pass', 'stone passed']
  }
]

interface FilterPreset {
  id: string
  name: string
  description: string
  terms: string[]
}

interface MatchLocation {
  noteId: string
  term: string
  start: number
  end: number
}

interface Props {
  notes: Note[]
  onApply: (noteIds: Set<string>, matches?: MatchLocation[]) => void
  onClose: () => void
}

const STORAGE_KEY = 'nota_smart_presets'

export function SmartFilter({ notes, onApply, onClose }: Props) {
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_PRESETS
    } catch {
      return DEFAULT_PRESETS
    }
  })
  
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTerms, setEditTerms] = useState('')
  
  // Additional filters
  const [customTerms, setCustomTerms] = useState<string[]>([])
  const [excludeTerms, setExcludeTerms] = useState<string[]>([])
  const [minLength, setMinLength] = useState(0)
  const [newTerm, setNewTerm] = useState('')
  const [newExclude, setNewExclude] = useState('')
  const [autoTag, setAutoTag] = useState(false)

  function savePresets(updated: FilterPreset[]) {
    setPresets(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // Get all active include terms
  const activeTerms = useMemo(() => {
    const terms: string[] = [...customTerms]
    for (const id of selected) {
      const preset = presets.find(p => p.id === id)
      if (preset) terms.push(...preset.terms)
    }
    return terms
  }, [selected, presets, customTerms])

  // Calculate matches
  const { matchingNotes, matchLocations } = useMemo(() => {
    if (activeTerms.length === 0 && excludeTerms.length === 0 && minLength === 0) {
      return { matchingNotes: new Set(notes.map(n => n.id)), matchLocations: [] }
    }

    const matching = new Set<string>()
    const locations: MatchLocation[] = []

    for (const note of notes) {
      // Min length check
      if (minLength > 0 && note.text.length < minLength) continue
      
      const textLower = note.text.toLowerCase()
      
      // Exclude check
      let excluded = false
      for (const term of excludeTerms) {
        if (textLower.includes(term.toLowerCase())) {
          excluded = true
          break
        }
      }
      if (excluded) continue
      
      // Include check
      if (activeTerms.length > 0) {
        let found = false
        for (const term of activeTerms) {
          const termLower = term.toLowerCase().trim()
          let idx = textLower.indexOf(termLower)
          
          while (idx !== -1) {
            found = true
            locations.push({
              noteId: note.id,
              term: note.text.slice(idx, idx + term.length),
              start: idx,
              end: idx + term.length
            })
            idx = textLower.indexOf(termLower, idx + 1)
          }
        }
        if (!found) continue
      }

      matching.add(note.id)
    }

    return { matchingNotes: matching, matchLocations: locations }
  }, [notes, activeTerms, excludeTerms, minLength])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function startEdit(preset: FilterPreset) {
    setEditingId(preset.id)
    setEditTerms(preset.terms.join(', '))
  }

  function saveEdit() {
    if (!editingId) return
    const terms = editTerms.split(',').map(t => t.trim()).filter(t => t)
    const updated = presets.map(p => 
      p.id === editingId ? { ...p, terms } : p
    )
    savePresets(updated)
    setEditingId(null)
  }

  function resetPreset(id: string) {
    const original = DEFAULT_PRESETS.find(p => p.id === id)
    if (!original) return
    const updated = presets.map(p => p.id === id ? { ...original } : p)
    savePresets(updated)
  }

  function resetAll() {
    savePresets(DEFAULT_PRESETS)
    setSelected(new Set())
    setCustomTerms([])
    setExcludeTerms([])
    setMinLength(0)
  }

  function addCustomTerm() {
    const t = newTerm.trim()
    if (t && !customTerms.includes(t)) {
      setCustomTerms([...customTerms, t])
      setNewTerm('')
    }
  }

  function addExcludeTerm() {
    const t = newExclude.trim()
    if (t && !excludeTerms.includes(t)) {
      setExcludeTerms([...excludeTerms, t])
      setNewExclude('')
    }
  }

  function handleApply() {
    onApply(matchingNotes, autoTag ? matchLocations : undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-maple-800 rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-maple-200 dark:border-maple-700">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-maple-500" />
            <span className="text-sm font-medium text-maple-700 dark:text-maple-200">Smart Filter</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={resetAll} className="text-[10px] text-maple-400 hover:text-maple-600">Reset</button>
            <button onClick={onClose} className="text-maple-400 hover:text-maple-600"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Presets */}
          <div className="p-3 space-y-1 border-b border-maple-100 dark:border-maple-700">
            <div className="text-[9px] text-maple-400 uppercase tracking-wide mb-2">Presets (Ryan's Questions)</div>
            {presets.map(preset => (
              <div 
                key={preset.id}
                className={`rounded border text-[11px] ${
                  selected.has(preset.id)
                    ? 'border-maple-400 dark:border-maple-500 bg-maple-50 dark:bg-maple-700'
                    : 'border-maple-200 dark:border-maple-600'
                }`}
              >
                {editingId === preset.id ? (
                  <div className="p-2 space-y-2">
                    <textarea
                      value={editTerms}
                      onChange={e => setEditTerms(e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1 text-[10px] bg-white dark:bg-maple-800 border border-maple-300 dark:border-maple-600 rounded dark:text-maple-200"
                      placeholder="comma separated"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="flex items-center gap-1 px-2 py-0.5 text-[9px] bg-maple-700 text-white rounded"><Check size={10} />Save</button>
                      <button onClick={() => setEditingId(null)} className="px-2 py-0.5 text-[9px] text-maple-500">Cancel</button>
                      <button onClick={() => { resetPreset(preset.id); setEditingId(null) }} className="px-2 py-0.5 text-[9px] text-maple-400">Reset</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2">
                    <button
                      onClick={() => toggle(preset.id)}
                      className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                        selected.has(preset.id) ? 'bg-maple-700 border-maple-700' : 'border-maple-300 dark:border-maple-500'
                      }`}
                    >
                      {selected.has(preset.id) && <Check size={8} className="text-white" />}
                    </button>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(preset.id)}>
                      <span className="font-medium text-maple-700 dark:text-maple-200">{preset.name}</span>
                      <span className="text-maple-400 dark:text-maple-500 ml-2">{preset.description}</span>
                    </div>
                    <button onClick={() => startEdit(preset)} className="p-1 text-maple-400 hover:text-maple-600">
                      <Pencil size={10} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Custom Terms */}
          <div className="p-3 space-y-3 border-b border-maple-100 dark:border-maple-700">
            <div>
              <div className="text-[9px] text-maple-400 uppercase tracking-wide mb-1.5">Add Custom Terms</div>
              <div className="flex gap-1.5">
                <input
                  value={newTerm}
                  onChange={e => setNewTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomTerm()}
                  placeholder="e.g. staghorn calculus"
                  className="flex-1 px-2 py-1 text-[11px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
                />
                <button onClick={addCustomTerm} disabled={!newTerm.trim()} className="px-2 py-1 text-[10px] bg-green-600 text-white rounded disabled:opacity-40">
                  <Plus size={12} />
                </button>
              </div>
              {customTerms.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {customTerms.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded">
                      {t}
                      <button onClick={() => setCustomTerms(customTerms.filter((_, j) => j !== i))}><X size={8} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-[9px] text-maple-400 uppercase tracking-wide mb-1.5">Exclude Notes Containing</div>
              <div className="flex gap-1.5">
                <input
                  value={newExclude}
                  onChange={e => setNewExclude(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addExcludeTerm()}
                  placeholder="e.g. telephone note"
                  className="flex-1 px-2 py-1 text-[11px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
                />
                <button onClick={addExcludeTerm} disabled={!newExclude.trim()} className="px-2 py-1 text-[10px] bg-red-600 text-white rounded disabled:opacity-40">
                  <Plus size={12} />
                </button>
              </div>
              {excludeTerms.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {excludeTerms.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded">
                      {t}
                      <button onClick={() => setExcludeTerms(excludeTerms.filter((_, j) => j !== i))}><X size={8} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] text-maple-400 uppercase">Min Length</span>
              <input
                type="number"
                value={minLength || ''}
                onChange={e => setMinLength(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-20 px-2 py-1 text-[11px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
              />
              <span className="text-[9px] text-maple-400">chars</span>
            </div>
          </div>

          {/* Auto-tag */}
          <div className="px-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoTag}
                onChange={e => setAutoTag(e.target.checked)}
                className="rounded border-maple-300 text-maple-600"
              />
              <Tag size={12} className="text-maple-400" />
              <span className="text-[10px] text-maple-600 dark:text-maple-300">Auto-tag matched phrases as suggestions</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-maple-200 dark:border-maple-700 bg-maple-50 dark:bg-maple-700/50">
          <div className="text-[11px] text-maple-600 dark:text-maple-300">
            <span className="font-medium">{matchingNotes.size}</span>
            <span className="text-maple-400"> / {notes.length}</span>
            {autoTag && matchLocations.length > 0 && (
              <span className="text-maple-400"> ({matchLocations.length} tags)</span>
            )}
          </div>
          <button
            onClick={handleApply}
            disabled={selected.size === 0 && customTerms.length === 0 && excludeTerms.length === 0 && minLength === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] text-white bg-maple-700 hover:bg-maple-600 rounded disabled:opacity-40"
          >
            <Search size={12} />
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
