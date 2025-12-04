import { useState, useMemo } from 'react'
import { X, Plus, Search, Zap, Tag, Pencil, Trash2, Check } from 'lucide-react'
import type { Note } from '../lib/types'

// Ryan's 10 research questions mapped to filter presets
const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'q1-symptoms',
    name: 'Q1: Symptoms',
    description: 'Does patient have symptoms from kidney stone disease?',
    terms: ['flank pain', 'hematuria', 'gross hematuria', 'bloody urine'],
    minLength: 0
  },
  {
    id: 'q2-growth',
    name: 'Q2: Stone Growth',
    description: 'Are kidney stones growing? (disease progression)',
    terms: ['interval stone growth', 'stones are growing', 'stone growth', 'increased stone burden'],
    minLength: 0
  },
  {
    id: 'q3-rare',
    name: 'Q3: Rare Disease',
    description: 'Rare stone disease indicators (pre-diagnosis)',
    terms: ['cystinuria', 'cystine', 'primary hyperoxaluria'],
    minLength: 0
  },
  {
    id: 'q4-sdoh',
    name: 'Q4: SDOH',
    description: 'Social determinants of health variables',
    terms: ['homeless', 'housing', 'employment', 'insurance', 'transportation', 'social support'],
    minLength: 0
  },
  {
    id: 'q5-devices',
    name: 'Q5: Equipment/Devices',
    description: 'Granular equipment from operative notes (Fr, french)',
    terms: [' Fr', 'french', 'percuflex', 'nitinol', 'basket', 'laser', 'stent'],
    minLength: 0
  },
  {
    id: 'q6-radiology',
    name: 'Q6: Radiology',
    description: 'Stone sizes, kidney, obstruction (3 mm, 3mm)',
    terms: ['3 mm', '3mm', '4 mm', '4mm', '5 mm', '5mm', 'hydronephrosis', 'hydroureter', 'nonobstructing', 'left kidney', 'right kidney'],
    minLength: 0
  },
  {
    id: 'q7-dietary',
    name: 'Q7: Dietary Advice',
    description: 'Dietary recommendations for prevention',
    terms: ['water', 'soda', 'protein', 'salt', 'sodium', 'oxalate', 'spinach', 'fluid intake'],
    minLength: 0
  },
  {
    id: 'q8-er',
    name: 'Q8: ER Visit',
    description: 'Text patterns around ER visit for passing stone',
    terms: ['emergency department', 'emergency room', 'ED ', 'ER ', 'acute', 'passing a stone', 'renal colic'],
    minLength: 0
  },
  {
    id: 'q9-complications',
    name: 'Q9: Complications',
    description: 'Post-surgery complications (0-30 days)',
    terms: ['complication', 'readmit', 'fever', 'infection', 'sepsis', 'bleeding', 'post-operative', 'postoperative'],
    minLength: 0
  },
  {
    id: 'q10-passage',
    name: 'Q10: Stone Passage',
    description: 'Patient passed stones without clinical care',
    terms: ['passed a stone', 'passed stone', 'saw a stone pass', 'stone passed', 'passed x stones'],
    minLength: 0
  }
]

interface FilterPreset {
  id: string
  name: string
  description: string
  terms: string[]
  minLength: number
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
  const [autoTag, setAutoTag] = useState(false)

  // Save presets
  function savePresets(updated: FilterPreset[]) {
    setPresets(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // Get all active terms from selected presets
  const activeTerms = useMemo(() => {
    const terms: string[] = []
    for (const id of selected) {
      const preset = presets.find(p => p.id === id)
      if (preset) terms.push(...preset.terms)
    }
    return terms
  }, [selected, presets])

  // Calculate matches
  const { matchingNotes, matchLocations } = useMemo(() => {
    if (activeTerms.length === 0) {
      return { matchingNotes: new Set(notes.map(n => n.id)), matchLocations: [] }
    }

    const matching = new Set<string>()
    const locations: MatchLocation[] = []

    for (const note of notes) {
      const textLower = note.text.toLowerCase()
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

      if (found) matching.add(note.id)
    }

    return { matchingNotes: matching, matchLocations: locations }
  }, [notes, activeTerms])

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
  }

  function handleApply() {
    onApply(matchingNotes, autoTag ? matchLocations : undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-maple-800 rounded-lg shadow-xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-maple-200 dark:border-maple-700">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-maple-500 dark:text-maple-400" />
            <span className="text-sm font-medium text-maple-700 dark:text-maple-200">Smart Filter</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={resetAll}
              className="text-[10px] text-maple-400 hover:text-maple-600 dark:hover:text-maple-300"
            >
              Reset all
            </button>
            <button onClick={onClose} className="text-maple-400 hover:text-maple-600 dark:hover:text-maple-200">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Presets list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {presets.map(preset => (
            <div 
              key={preset.id}
              className={`rounded-lg border transition-all ${
                selected.has(preset.id)
                  ? 'border-maple-400 dark:border-maple-500 bg-maple-50 dark:bg-maple-700'
                  : 'border-maple-200 dark:border-maple-600 hover:border-maple-300 dark:hover:border-maple-500'
              }`}
            >
              {editingId === preset.id ? (
                // Edit mode
                <div className="p-3 space-y-2">
                  <div className="text-[11px] font-medium text-maple-600 dark:text-maple-300">{preset.name}</div>
                  <textarea
                    value={editTerms}
                    onChange={e => setEditTerms(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1.5 text-[11px] bg-white dark:bg-maple-800 border border-maple-300 dark:border-maple-600 rounded focus:outline-none focus:border-maple-400 dark:text-maple-200"
                    placeholder="comma separated terms"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] bg-maple-700 dark:bg-maple-600 text-white rounded hover:bg-maple-600"
                    >
                      <Check size={10} /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-[10px] text-maple-500 hover:text-maple-700 dark:hover:text-maple-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { resetPreset(preset.id); setEditingId(null) }}
                      className="px-2 py-1 text-[10px] text-maple-400 hover:text-maple-600 dark:hover:text-maple-300"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : (
                // Normal mode
                <div className="flex items-start gap-2 p-2.5">
                  <button
                    onClick={() => toggle(preset.id)}
                    className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                      selected.has(preset.id)
                        ? 'bg-maple-700 dark:bg-maple-500 border-maple-700 dark:border-maple-500'
                        : 'border-maple-300 dark:border-maple-500'
                    }`}
                  >
                    {selected.has(preset.id) && <Check size={10} className="text-white" />}
                  </button>
                  
                  <div className="flex-1 min-w-0" onClick={() => toggle(preset.id)}>
                    <div className="text-[11px] font-medium text-maple-700 dark:text-maple-200 cursor-pointer">
                      {preset.name}
                    </div>
                    <div className="text-[9px] text-maple-400 dark:text-maple-500 mb-1">
                      {preset.description}
                    </div>
                    <div className="text-[9px] text-maple-500 dark:text-maple-400 leading-relaxed">
                      {preset.terms.slice(0, 5).join(', ')}
                      {preset.terms.length > 5 && ` +${preset.terms.length - 5} more`}
                    </div>
                  </div>

                  <button
                    onClick={() => startEdit(preset)}
                    className="p-1 text-maple-400 hover:text-maple-600 dark:hover:text-maple-300"
                    title="Edit terms"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Auto-tag option */}
        <div className="px-4 py-2 border-t border-maple-100 dark:border-maple-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoTag}
              onChange={e => setAutoTag(e.target.checked)}
              className="rounded border-maple-300 dark:border-maple-600 text-maple-600"
            />
            <Tag size={12} className="text-maple-400" />
            <span className="text-[10px] text-maple-600 dark:text-maple-300">Auto-tag matched phrases</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-maple-200 dark:border-maple-700 bg-maple-50 dark:bg-maple-700/50">
          <div className="text-[11px] text-maple-600 dark:text-maple-300">
            <span className="font-medium">{matchingNotes.size}</span>
            <span className="text-maple-400 dark:text-maple-500"> / {notes.length} notes</span>
            {autoTag && selected.size > 0 && (
              <span className="text-maple-400 dark:text-maple-500"> ({matchLocations.length} tags)</span>
            )}
          </div>
          <button
            onClick={handleApply}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] text-white bg-maple-700 dark:bg-maple-600 hover:bg-maple-600 dark:hover:bg-maple-500 rounded disabled:opacity-40"
          >
            <Search size={12} />
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
