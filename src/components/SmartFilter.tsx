import { useState, useMemo } from 'react'
import { X, Plus, Search, Zap, Tag } from 'lucide-react'
import type { Note } from '../lib/types'

// Preset filters based on Ryan's research - phrase patterns, not just words
const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'symptoms',
    name: 'Symptoms',
    include: ['flank pain', 'hematuria', 'gross hematuria', 'bloody urine'],
    exclude: [],
    minLength: 200
  },
  {
    id: 'stone-growth',
    name: 'Stone Growth',
    include: ['stone growth', 'stones are growing', 'interval growth', 'increased stone burden'],
    exclude: [],
    minLength: 200
  },
  {
    id: 'rare-disease',
    name: 'Rare Disease',
    include: ['cystinuria', 'cystine', 'primary hyperoxaluria'],
    exclude: [],
    minLength: 100
  },
  {
    id: 'measurements',
    name: 'Measurements',
    include: ['mm', ' cm ', 'x'],
    exclude: [],
    minLength: 100
  },
  {
    id: 'radiology',
    name: 'Radiology',
    include: ['nonobstructing', 'hydronephrosis', 'hydroureter', 'calculi', 'renal stone'],
    exclude: ['telephone', 'phone call'],
    minLength: 300
  },
  {
    id: 'operative',
    name: 'Operative',
    include: ['ureteroscopy', 'cystoscopy', 'PCNL', 'stent placed', 'laser', 'french', ' Fr'],
    exclude: ['physical therapy', 'occupational therapy', 'preoperative evaluation'],
    minLength: 500
  },
  {
    id: 'dietary',
    name: 'Dietary',
    include: ['water intake', 'fluid intake', 'low sodium', 'low oxalate', 'dietary advice'],
    exclude: [],
    minLength: 200
  },
  {
    id: 'er-visit',
    name: 'ER Visit',
    include: ['emergency department', 'ED visit', 'ER visit', 'acute stone', 'passing a stone'],
    exclude: [],
    minLength: 200
  },
  {
    id: 'complications',
    name: 'Complications',
    include: ['complication', 'readmitted', 'post-operative', 'infection', 'sepsis', 'fever'],
    exclude: [],
    minLength: 200
  },
  {
    id: 'stone-passage',
    name: 'Stone Passage',
    include: ['passed a stone', 'passed stone', 'saw a stone pass', 'stone passed'],
    exclude: [],
    minLength: 100
  }
]

interface FilterPreset {
  id: string
  name: string
  include: string[]
  exclude: string[]
  minLength: number
}

interface MatchLocation {
  noteId: string
  term: string
  start: number
  end: number
  context: string
}

interface Props {
  notes: Note[]
  onApply: (noteIds: Set<string>, matches?: MatchLocation[]) => void
  onClose: () => void
}

export function SmartFilter({ notes, onApply, onClose }: Props) {
  const [presets] = useState<FilterPreset[]>(() => {
    const saved = localStorage.getItem('nota_filter_presets')
    return saved ? JSON.parse(saved) : DEFAULT_PRESETS
  })
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set())
  const [customTerms, setCustomTerms] = useState<string[]>([])
  const [excludeTerms, setExcludeTerms] = useState<string[]>([])
  const [minLength, setMinLength] = useState(0)
  const [newTerm, setNewTerm] = useState('')
  const [newExclude, setNewExclude] = useState('')
  const [autoTag, setAutoTag] = useState(false)

  // Get all active include terms
  const activeIncludeTerms = useMemo(() => {
    const terms = new Set<string>()
    for (const presetId of selectedPresets) {
      const preset = presets.find(p => p.id === presetId)
      if (preset) {
        for (const t of preset.include) terms.add(t)
      }
    }
    for (const t of customTerms) terms.add(t)
    return Array.from(terms)
  }, [selectedPresets, customTerms, presets])

  // Get all active exclude terms
  const activeExcludeTerms = useMemo(() => {
    const terms = new Set<string>()
    for (const presetId of selectedPresets) {
      const preset = presets.find(p => p.id === presetId)
      if (preset) {
        for (const t of preset.exclude) terms.add(t)
      }
    }
    for (const t of excludeTerms) terms.add(t)
    return Array.from(terms)
  }, [selectedPresets, excludeTerms, presets])

  // Get effective min length
  const effectiveMinLength = useMemo(() => {
    let max = minLength
    for (const presetId of selectedPresets) {
      const preset = presets.find(p => p.id === presetId)
      if (preset && preset.minLength > max) max = preset.minLength
    }
    return max
  }, [selectedPresets, minLength, presets])

  // Calculate matching notes and locations
  const { matchingNotes, matchLocations } = useMemo(() => {
    const matching = new Set<string>()
    const locations: MatchLocation[] = []
    
    if (activeIncludeTerms.length === 0 && activeExcludeTerms.length === 0 && effectiveMinLength === 0) {
      return { matchingNotes: new Set(notes.map(n => n.id)), matchLocations: [] }
    }

    for (const note of notes) {
      const textLower = note.text.toLowerCase()
      
      // Length check
      if (effectiveMinLength > 0 && note.text.length < effectiveMinLength) continue
      
      // Exclude check
      let excluded = false
      for (const term of activeExcludeTerms) {
        if (textLower.includes(term.toLowerCase())) {
          excluded = true
          break
        }
      }
      if (excluded) continue
      
      // Include check with location tracking
      if (activeIncludeTerms.length > 0) {
        let found = false
        for (const term of activeIncludeTerms) {
          const termLower = term.toLowerCase()
          let idx = textLower.indexOf(termLower)
          while (idx !== -1) {
            found = true
            // Get context (50 chars before and after)
            const start = Math.max(0, idx - 30)
            const end = Math.min(note.text.length, idx + term.length + 30)
            const context = (start > 0 ? '...' : '') + 
                           note.text.slice(start, end) + 
                           (end < note.text.length ? '...' : '')
            
            locations.push({
              noteId: note.id,
              term,
              start: idx,
              end: idx + term.length,
              context
            })
            
            idx = textLower.indexOf(termLower, idx + 1)
          }
        }
        if (!found) continue
      }
      
      matching.add(note.id)
    }
    
    return { matchingNotes: matching, matchLocations: locations }
  }, [notes, activeIncludeTerms, activeExcludeTerms, effectiveMinLength])

  function togglePreset(id: string) {
    const next = new Set(selectedPresets)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedPresets(next)
  }

  function addTerm() {
    const t = newTerm.trim()
    if (t && !customTerms.includes(t)) {
      setCustomTerms([...customTerms, t])
      setNewTerm('')
    }
  }

  function addExclude() {
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

  function clearAll() {
    setSelectedPresets(new Set())
    setCustomTerms([])
    setExcludeTerms([])
    setMinLength(0)
  }

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-maple-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-maple-200 dark:border-maple-700">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-maple-600 dark:text-maple-300" />
            <span className="text-sm font-medium text-maple-800 dark:text-maple-100">Smart Filter</span>
          </div>
          <button onClick={onClose} className="text-maple-400 hover:text-maple-600 dark:hover:text-maple-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Presets as chips */}
          <div>
            <div className="text-[10px] text-maple-500 dark:text-maple-400 uppercase tracking-wide mb-2">Presets</div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePreset(p.id)}
                  className={`px-2.5 py-1 text-[11px] rounded-full border transition-all ${
                    selectedPresets.has(p.id)
                      ? 'bg-maple-700 dark:bg-maple-600 text-white border-maple-700 dark:border-maple-600'
                      : 'border-maple-300 dark:border-maple-600 text-maple-600 dark:text-maple-300 hover:border-maple-400 dark:hover:border-maple-500'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Active terms display */}
          {activeIncludeTerms.length > 0 && (
            <div>
              <div className="text-[10px] text-maple-500 dark:text-maple-400 uppercase tracking-wide mb-2">Searching for</div>
              <div className="flex flex-wrap gap-1">
                {activeIncludeTerms.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom term input */}
          <div>
            <div className="text-[10px] text-maple-500 dark:text-maple-400 uppercase tracking-wide mb-2">Add terms</div>
            <div className="flex gap-2">
              <input
                value={newTerm}
                onChange={e => setNewTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTerm()}
                placeholder="e.g. passed a stone"
                className="flex-1 px-2.5 py-1.5 text-[11px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded focus:outline-none focus:border-maple-400 dark:text-maple-200"
              />
              <button
                onClick={addTerm}
                disabled={!newTerm.trim()}
                className="px-3 py-1.5 text-[11px] bg-maple-700 dark:bg-maple-600 text-white rounded hover:bg-maple-600 dark:hover:bg-maple-500 disabled:opacity-40"
              >
                <Plus size={14} />
              </button>
            </div>
            {customTerms.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {customTerms.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-maple-100 dark:bg-maple-700 text-maple-600 dark:text-maple-300 rounded">
                    {t}
                    <button onClick={() => setCustomTerms(customTerms.filter((_, j) => j !== i))}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Exclude terms */}
          <div>
            <div className="text-[10px] text-maple-500 dark:text-maple-400 uppercase tracking-wide mb-2">Exclude notes containing</div>
            <div className="flex gap-2">
              <input
                value={newExclude}
                onChange={e => setNewExclude(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addExclude()}
                placeholder="e.g. telephone note"
                className="flex-1 px-2.5 py-1.5 text-[11px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded focus:outline-none focus:border-maple-400 dark:text-maple-200"
              />
              <button
                onClick={addExclude}
                disabled={!newExclude.trim()}
                className="px-3 py-1.5 text-[11px] bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-40"
              >
                <Plus size={14} />
              </button>
            </div>
            {(activeExcludeTerms.length > 0) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {activeExcludeTerms.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded">
                    {t}
                    {excludeTerms.includes(t) && (
                      <button onClick={() => setExcludeTerms(excludeTerms.filter(x => x !== t))}>
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Min length */}
          <div className="flex items-center gap-3">
            <div className="text-[10px] text-maple-500 dark:text-maple-400 uppercase tracking-wide">Min length</div>
            <input
              type="number"
              value={minLength || ''}
              onChange={e => setMinLength(parseInt(e.target.value) || 0)}
              placeholder="0"
              min={0}
              step={100}
              className="w-20 px-2 py-1 text-[11px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
            />
            <span className="text-[10px] text-maple-400 dark:text-maple-500">chars</span>
          </div>

          {/* Auto-tag option */}
          <label className="flex items-center gap-2 p-3 bg-maple-50 dark:bg-maple-700 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={autoTag}
              onChange={e => setAutoTag(e.target.checked)}
              className="rounded border-maple-300 dark:border-maple-600 text-maple-600"
            />
            <Tag size={14} className="text-maple-500 dark:text-maple-400" />
            <div>
              <div className="text-[11px] text-maple-700 dark:text-maple-200">Auto-tag matches</div>
              <div className="text-[9px] text-maple-500 dark:text-maple-400">Create suggested annotations for matched phrases</div>
            </div>
          </label>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-maple-200 dark:border-maple-700 bg-maple-50 dark:bg-maple-700/50">
          <div className="text-[11px]">
            <span className="font-medium text-maple-700 dark:text-maple-200">{matchingNotes.size.toLocaleString()}</span>
            <span className="text-maple-500 dark:text-maple-400"> notes</span>
            {autoTag && matchLocations.length > 0 && (
              <span className="text-maple-400 dark:text-maple-500"> ({matchLocations.length} tags)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-[11px] text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
            >
              Clear
            </button>
            <button
              onClick={handleApply}
              disabled={matchingNotes.size === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] text-white bg-maple-800 dark:bg-maple-600 hover:bg-maple-700 dark:hover:bg-maple-500 rounded disabled:opacity-50"
            >
              <Search size={12} />
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
