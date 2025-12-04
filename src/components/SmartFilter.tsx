import { useState, useMemo } from 'react'
import { X, Sliders, ChevronDown, ChevronUp, Plus, Trash2, Search } from 'lucide-react'
import type { Note } from '../lib/types'

// Preset filters based on Ryan's research questions
const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'symptoms',
    name: 'Symptoms',
    description: 'Flank pain, hematuria, bloody urine',
    include: ['flank pain', 'hematuria', 'gross hematuria', 'bloody urine'],
    exclude: [],
    minLength: 200
  },
  {
    id: 'stone-growth',
    name: 'Stone Growth',
    description: 'Disease progression indicators',
    include: ['stone growth', 'stones are growing', 'interval growth', 'increased stone burden'],
    exclude: [],
    minLength: 200
  },
  {
    id: 'rare-disease',
    name: 'Rare Stone Disease',
    description: 'Cystinuria, hyperoxaluria',
    include: ['cystinuria', 'cystine', 'primary hyperoxaluria', 'hyperoxaluria'],
    exclude: [],
    minLength: 100
  },
  {
    id: 'measurements',
    name: 'Stone Measurements',
    description: 'Size measurements in mm',
    include: ['mm', 'cm', 'x'],
    exclude: [],
    minLength: 100
  },
  {
    id: 'radiology',
    name: 'Radiology Reports',
    description: 'CT, ultrasound, KUB with findings',
    include: ['kidney', 'renal', 'stone', 'calcul'],
    exclude: ['telephone', 'phone call'],
    minLength: 300
  },
  {
    id: 'operative',
    name: 'Operative Notes',
    description: 'Procedures with device details',
    include: ['ureteroscopy', 'cystoscopy', 'PCNL', 'stent', 'laser', 'french', 'Fr'],
    exclude: ['physical therapy', 'occupational therapy', 'preoperative evaluation'],
    minLength: 500
  },
  {
    id: 'dietary',
    name: 'Dietary Advice',
    description: 'Nutrition recommendations',
    include: ['water intake', 'sodium', 'oxalate', 'citrate', 'dietary', 'fluid intake'],
    exclude: [],
    minLength: 200
  },
  {
    id: 'er-visit',
    name: 'ER Visits',
    description: 'Emergency department for stones',
    include: ['emergency', 'ED ', 'ER ', 'acute', 'passing a stone', 'passed stone'],
    exclude: [],
    minLength: 200
  },
  {
    id: 'complications',
    name: 'Post-Op Complications',
    description: 'Issues after surgery',
    include: ['complication', 'readmit', 'returned', 'post-operative', 'postoperative', 'infection', 'bleeding'],
    exclude: [],
    minLength: 200
  },
  {
    id: 'stone-passage',
    name: 'Stone Passage',
    description: 'Patient passed stones at home',
    include: ['passed a stone', 'passed stone', 'saw a stone', 'stone passage', 'passed x stone'],
    exclude: [],
    minLength: 100
  }
]

interface FilterPreset {
  id: string
  name: string
  description: string
  include: string[]
  exclude: string[]
  minLength: number
}

interface Props {
  notes: Note[]
  onApply: (noteIds: Set<string>) => void
  onClose: () => void
}

export function SmartFilter({ notes, onApply, onClose }: Props) {
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    const saved = localStorage.getItem('nota_filter_presets')
    return saved ? JSON.parse(saved) : DEFAULT_PRESETS
  })
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Custom filter state
  const [includeTerms, setIncludeTerms] = useState<string[]>([])
  const [excludeTerms, setExcludeTerms] = useState<string[]>([])
  const [minLength, setMinLength] = useState(0)
  const [newInclude, setNewInclude] = useState('')
  const [newExclude, setNewExclude] = useState('')

  // Load preset into custom filter
  function loadPreset(preset: FilterPreset) {
    setSelectedPreset(preset.id)
    setIncludeTerms([...preset.include])
    setExcludeTerms([...preset.exclude])
    setMinLength(preset.minLength)
  }

  // Calculate matching notes
  const matchingNotes = useMemo(() => {
    if (includeTerms.length === 0 && excludeTerms.length === 0 && minLength === 0) {
      return new Set(notes.map(n => n.id))
    }

    const matching = new Set<string>()
    
    for (const note of notes) {
      const textLower = note.text.toLowerCase()
      
      // Length check
      if (minLength > 0 && note.text.length < minLength) continue
      
      // Exclude check - skip if any exclude term found
      let excluded = false
      for (const term of excludeTerms) {
        if (textLower.includes(term.toLowerCase())) {
          excluded = true
          break
        }
      }
      if (excluded) continue
      
      // Include check - must have at least one include term (OR logic)
      if (includeTerms.length > 0) {
        let found = false
        for (const term of includeTerms) {
          if (textLower.includes(term.toLowerCase())) {
            found = true
            break
          }
        }
        if (!found) continue
      }
      
      matching.add(note.id)
    }
    
    return matching
  }, [notes, includeTerms, excludeTerms, minLength])

  function handleApply() {
    onApply(matchingNotes)
    onClose()
  }

  function addIncludeTerm() {
    if (newInclude.trim() && !includeTerms.includes(newInclude.trim())) {
      setIncludeTerms([...includeTerms, newInclude.trim()])
      setNewInclude('')
      setSelectedPreset(null)
    }
  }

  function addExcludeTerm() {
    if (newExclude.trim() && !excludeTerms.includes(newExclude.trim())) {
      setExcludeTerms([...excludeTerms, newExclude.trim()])
      setNewExclude('')
      setSelectedPreset(null)
    }
  }

  function clearFilters() {
    setIncludeTerms([])
    setExcludeTerms([])
    setMinLength(0)
    setSelectedPreset(null)
  }

  function saveAsPreset() {
    const name = prompt('Preset name:')
    if (!name) return
    
    const newPreset: FilterPreset = {
      id: `custom_${Date.now()}`,
      name,
      description: 'Custom filter',
      include: [...includeTerms],
      exclude: [...excludeTerms],
      minLength
    }
    
    const updated = [...presets, newPreset]
    setPresets(updated)
    localStorage.setItem('nota_filter_presets', JSON.stringify(updated))
    setSelectedPreset(newPreset.id)
  }

  function deletePreset(id: string) {
    if (!confirm('Delete this preset?')) return
    const updated = presets.filter(p => p.id !== id)
    setPresets(updated)
    localStorage.setItem('nota_filter_presets', JSON.stringify(updated))
    if (selectedPreset === id) {
      clearFilters()
    }
  }

  function resetToDefaults() {
    if (!confirm('Reset to default presets? Custom presets will be removed.')) return
    setPresets(DEFAULT_PRESETS)
    localStorage.removeItem('nota_filter_presets')
    clearFilters()
  }

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-maple-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-maple-200 dark:border-maple-700">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-maple-600 dark:text-maple-300" />
            <h2 className="text-sm font-medium text-maple-800 dark:text-maple-100">Smart Filter</h2>
          </div>
          <button onClick={onClose} className="text-maple-400 dark:text-maple-500 hover:text-maple-600 dark:hover:text-maple-300">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Presets */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-maple-600 dark:text-maple-300 uppercase tracking-wide">Presets</h3>
              <button
                onClick={resetToDefaults}
                className="text-[10px] text-maple-400 dark:text-maple-500 hover:text-maple-600 dark:hover:text-maple-300"
              >
                Reset to defaults
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => loadPreset(preset)}
                  className={`text-left p-2.5 rounded-lg border transition-all ${
                    selectedPreset === preset.id
                      ? 'border-maple-400 dark:border-maple-500 bg-maple-50 dark:bg-maple-700'
                      : 'border-maple-200 dark:border-maple-600 hover:border-maple-300 dark:hover:border-maple-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-[11px] font-medium text-maple-700 dark:text-maple-200">{preset.name}</div>
                    {preset.id.startsWith('custom_') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePreset(preset.id) }}
                        className="text-maple-400 hover:text-red-500 -mt-0.5"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div className="text-[9px] text-maple-500 dark:text-maple-400 mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-[11px] text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200 mb-3"
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Advanced: customize filter
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-maple-50 dark:bg-maple-700 rounded-lg">
              {/* Include terms */}
              <div>
                <label className="text-[10px] font-medium text-maple-600 dark:text-maple-300 uppercase tracking-wide">
                  Include (OR logic)
                </label>
                <p className="text-[9px] text-maple-400 dark:text-maple-500 mb-2">Notes must contain at least one of these terms</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {includeTerms.map((term, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded text-[10px]">
                      {term}
                      <button onClick={() => setIncludeTerms(includeTerms.filter((_, j) => j !== i))}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={newInclude}
                    onChange={e => setNewInclude(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addIncludeTerm()}
                    placeholder="Add term..."
                    className="flex-1 px-2 py-1 text-[11px] bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
                  />
                  <button
                    onClick={addIncludeTerm}
                    className="px-2 py-1 text-[10px] bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Exclude terms */}
              <div>
                <label className="text-[10px] font-medium text-maple-600 dark:text-maple-300 uppercase tracking-wide">
                  Exclude
                </label>
                <p className="text-[9px] text-maple-400 dark:text-maple-500 mb-2">Notes will be excluded if they contain any of these</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {excludeTerms.map((term, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded text-[10px]">
                      {term}
                      <button onClick={() => setExcludeTerms(excludeTerms.filter((_, j) => j !== i))}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={newExclude}
                    onChange={e => setNewExclude(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addExcludeTerm()}
                    placeholder="Add term to exclude..."
                    className="flex-1 px-2 py-1 text-[11px] bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
                  />
                  <button
                    onClick={addExcludeTerm}
                    className="px-2 py-1 text-[10px] bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Min length */}
              <div>
                <label className="text-[10px] font-medium text-maple-600 dark:text-maple-300 uppercase tracking-wide">
                  Minimum Length
                </label>
                <p className="text-[9px] text-maple-400 dark:text-maple-500 mb-2">Skip notes shorter than this (in characters)</p>
                <input
                  type="number"
                  value={minLength}
                  onChange={e => { setMinLength(parseInt(e.target.value) || 0); setSelectedPreset(null) }}
                  min={0}
                  step={100}
                  className="w-32 px-2 py-1 text-[11px] bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
                />
              </div>

              {/* Save preset */}
              {(includeTerms.length > 0 || excludeTerms.length > 0) && (
                <button
                  onClick={saveAsPreset}
                  className="text-[10px] text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
                >
                  Save as new preset...
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer with results and actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-maple-200 dark:border-maple-700 bg-maple-50 dark:bg-maple-700/50">
          <div className="text-[11px]">
            <span className="font-medium text-maple-700 dark:text-maple-200">{matchingNotes.size.toLocaleString()}</span>
            <span className="text-maple-500 dark:text-maple-400"> of {notes.length.toLocaleString()} notes match</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-[11px] text-maple-600 dark:text-maple-300 hover:bg-maple-100 dark:hover:bg-maple-600 rounded"
            >
              Clear
            </button>
            <button
              onClick={handleApply}
              disabled={matchingNotes.size === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] text-white bg-maple-800 dark:bg-maple-600 hover:bg-maple-700 dark:hover:bg-maple-500 rounded disabled:opacity-50"
            >
              <Search size={12} />
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
