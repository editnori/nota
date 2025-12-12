import { useState, useMemo, useEffect, useCallback } from 'react'
import { X, Search, ChevronRight, Ban, Plus, Trash2, Check } from 'lucide-react'
import { loadQuestions } from '../lib/questions'
import { ConfirmModal } from './ConfirmModal'
import type { Note } from '../lib/types'
import { extractRadiologyEntities, initRadiologyModel, type RadiologyEntity } from '../lib/radiology-inference'

// Default patterns per question
const DEFAULT_PATTERNS: Record<string, { terms: string[]; regex: string[]; negation: boolean }> = {
  Q1: { terms: ['flank pain', 'hematuria', 'gross hematuria', 'bloody urine', 'renal colic'], regex: [], negation: true },
  Q2: { terms: ['interval stone growth', 'stones are growing', 'increased stone burden', 'stone enlargement'], regex: [], negation: false },
  Q3: { terms: ['cystinuria', 'cystine', 'primary hyperoxaluria', 'staghorn'], regex: [], negation: false },
  Q4: { terms: ['homeless', 'housing', 'unemploy', 'uninsured', 'transportation'], regex: [], negation: false },
  Q5: { terms: ['percuflex', 'boston scientific', 'nitinol', 'basket', 'laser fiber', 'guidewire', 'foley'], regex: ['\\d+\\s*fr\\b', '\\d+x\\d+'], negation: false },
  Q6: { terms: ['hydronephrosis', 'hydroureter', 'nonobstructing', 'calculi', 'stone burden', 'bosniack'], regex: ['\\d+\\s*mm\\b', '\\d+\\s*cm\\b', '\\d+\\s*x\\s*\\d+', 'mgy'], negation: false },
  Q7: { terms: ['water intake', 'fluid intake', 'low sodium', 'low oxalate', 'dietary', 'litholink'], regex: [], negation: false },
  Q8: { terms: ['emergency department', 'emergency room', 'ED visit', 'ER visit', 'acute presentation'], regex: [], negation: false },
  Q9: { terms: ['complication', 'readmit', 'post-operative', 'infection', 'sepsis', 'fever'], regex: [], negation: false },
  Q10: { terms: ['passed a stone', 'passed stone', 'saw a stone pass', 'spontaneous passage'], regex: [], negation: false },
}

const NEGATION = ['no ', 'not ', 'denies ', 'negative for ', 'without ', 'absent ']

// Pre-compiled pattern cache for performance
interface CompiledPattern {
  terms: string[]  // Already lowercased
  regexes: RegExp[]  // Pre-compiled
  negation: boolean
}
type CompiledPatterns = Map<string, CompiledPattern>

function compilePatterns(
  patterns: Record<string, { terms: string[]; regex: string[]; negation: boolean }>,
  selectedIds: Set<string>
): CompiledPatterns {
  const compiled = new Map<string, CompiledPattern>()
  for (const qid of selectedIds) {
    const config = patterns[qid]
    if (!config) continue
    compiled.set(qid, {
      terms: config.terms.map(t => t.toLowerCase()),
      regexes: config.regex.map(rx => {
        try { return new RegExp(rx, 'gi') }
        catch { return null }
      }).filter((r): r is RegExp => r !== null),
      negation: config.negation
    })
  }
  return compiled
}

// Match now includes the question that found it
interface Match { 
  noteId: string
  term: string
  start: number
  end: number
  questionId: string  // Which question found this match
}

interface Props {
  notes: Note[]
  onApply: (noteIds: Set<string>, matches?: Match[]) => void
  onDeleteNonMatching?: (noteIdsToKeep: Set<string>) => void
  onClose: () => void
}

const PATTERNS_KEY = 'nota_filter_patterns'
const STATE_KEY = 'nota_filter_state'

export function SmartFilter({ notes, onApply, onDeleteNonMatching, onClose }: Props) {
  // Memoize questions load (already cached in questions.ts)
  const questions = useMemo(() => loadQuestions(), [])
  
  const [patterns, setPatterns] = useState<Record<string, { terms: string[]; regex: string[]; negation: boolean }>>(() => {
    try {
      const saved = localStorage.getItem(PATTERNS_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_PATTERNS
    } catch { return DEFAULT_PATTERNS }
  })
  
  // Load persisted state - single localStorage read for all state values
  const [selected, setSelected] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STATE_KEY)
      if (saved) {
        const state = JSON.parse(saved)
        return new Set(state.selected || [])
      }
    } catch {}
    return new Set()
  })
  
  // Parse STATE_KEY once and reuse
  const savedState = useMemo(() => {
    try {
      const saved = localStorage.getItem(STATE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  }, [])
  
  const [excludes, setExcludes] = useState(() => savedState?.excludes || '')
  const [minLen, setMinLen] = useState(() => savedState?.minLen || '')
  
  const [expanded, setExpanded] = useState<string | null>(null)
  const [autoTag, setAutoTag] = useState(false)
  const [newTerm, setNewTerm] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Model-based extraction for Q6 (radiology)
  const [useModel, setUseModel] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [modelProgress, setModelProgress] = useState({ current: 0, total: 0, status: '' })
  const [modelEntities, setModelEntities] = useState<Map<string, RadiologyEntity[]>>(new Map())
  const [modelError, setModelError] = useState<string | null>(null)
  const [showModelModal, setShowModelModal] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const isRadiologyNote = useCallback((note: Note) => {
    const id = note.id || ''
    if (id.startsWith('RAD')) return true
    const t = note.meta?.type?.toLowerCase() || ''
    if (t.includes('rad') || t.includes('imaging')) return true
    const text = note.text || note.meta?.rawText || ''
    return /\b(renal sonogram|renal ultrasound|ct abdomen|ct urogram|mri abdomen|impression:|findings:|kidneys\/ureters)\b/i.test(text)
  }, [])

  // Persist state on changes
  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      selected: Array.from(selected),
      excludes,
      minLen
    }))
  }, [selected, excludes, minLen])

  // Run model inference - triggered manually via button
  const runModelInference = useCallback(async () => {
    const controller = new AbortController()
    setAbortController(controller)
    setShowModelModal(true)
    setModelLoading(true)
    setModelError(null)
    setModelProgress({ current: 0, total: notes.length, status: 'Loading model...' })
    
    try {
      await initRadiologyModel()
      
      if (controller.signal.aborted) return
      
      setModelProgress({ current: 0, total: notes.length, status: 'Analyzing notes...' })
      
      const results = new Map<string, RadiologyEntity[]>()
      const batchSize = 20
      let processed = 0
      let foundEntities = 0
      
      for (let i = 0; i < notes.length; i += batchSize) {
        if (controller.signal.aborted) break
        
        const batch = notes.slice(i, i + batchSize)
        await Promise.all(batch.map(async (note) => {
          if (controller.signal.aborted) return
          try {
            if (!isRadiologyNote(note)) return
            const text = note.text  // Use displayed text so offsets match annotations/highlights
            const entities = await extractRadiologyEntities(text)
            if (entities.length > 0) {
              results.set(note.id, entities)
              foundEntities += entities.length
            }
          } catch (err) {
            console.error(`Error processing ${note.id}:`, err)
          }
        }))
        
        processed = Math.min(i + batchSize, notes.length)
        setModelProgress({ 
          current: processed, 
          total: notes.length, 
          status: `Found ${foundEntities} entities in ${results.size} notes...` 
        })
        
        // Yield to UI
        await new Promise(r => setTimeout(r, 0))
      }
      
      if (!controller.signal.aborted) {
        setModelEntities(results)
        setUseModel(true)
        setModelProgress({ 
          current: notes.length, 
          total: notes.length, 
          status: `Done! ${foundEntities} entities in ${results.size} notes` 
        })
        
        // Auto-close after success
        setTimeout(() => {
          if (!controller.signal.aborted) {
            setShowModelModal(false)
          }
        }, 1500)
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setModelError(err.message || 'Failed to load model')
        console.error('Model inference error:', err)
      }
    } finally {
      setModelLoading(false)
      setAbortController(null)
    }
  }, [notes, isRadiologyNote])
  
  const cancelModelInference = useCallback(() => {
    abortController?.abort()
    setShowModelModal(false)
    setModelLoading(false)
    setAbortController(null)
  }, [abortController])
  
  const clearModelResults = useCallback(() => {
    setModelEntities(new Map())
    setUseModel(false)
  }, [])

  function savePatterns(updated: typeof patterns) {
    setPatterns(updated)
    localStorage.setItem(PATTERNS_KEY, JSON.stringify(updated))
  }

  // Pre-compile patterns when selection or patterns change (not per-note)
  const compiledPatterns = useMemo(() => 
    compilePatterns(patterns, selected), 
    [patterns, selected]
  )

  // Calculate matches - optimized with pre-compiled patterns
  const { matchingNotes, matches, excludedCount, modelMatchCount } = useMemo(() => {
    const matching = new Set<string>()
    const allMatches: Match[] = []
    let excluded = 0
    let modelMatches = 0

    // Pre-process excludes once (not per-note)
    const excludeTerms = excludes.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
    const minLength = parseInt(minLen) || 0
    const collectMatches = autoTag // Only collect detailed matches if needed

    for (const note of notes) {
      // Early exit checks first (cheapest operations)
      if (minLength && note.text.length < minLength) { excluded++; continue }
      
      const lower = note.text.toLowerCase()
      
      // Exclude check - early exit
      if (excludeTerms.length > 0 && excludeTerms.some((ex: string) => lower.includes(ex))) { 
        excluded++
        continue 
      }

      // No filters selected = all notes match
      if (selected.size === 0) { 
        matching.add(note.id)
        continue 
      }

      let found = false
      
      // Check model entities for Q6 if useModel is enabled
      if (useModel && selected.has('Q6') && modelEntities.has(note.id)) {
        found = true
        modelMatches++
        if (collectMatches) {
          const entities = modelEntities.get(note.id)!
          for (const ent of entities) {
            allMatches.push({
              noteId: note.id,
              term: ent.text,  // Just the text, no type prefix
              start: ent.start,
              end: ent.end,
              questionId: 'Q6'
            })
          }
        }
      }
      
      // Use pre-compiled patterns (skip Q6 if using model)
      for (const [qid, compiled] of compiledPatterns) {
        // Skip Q6 pattern matching if using model
        if (useModel && qid === 'Q6') continue
        
        // Check pre-lowercased terms
        for (const term of compiled.terms) {
          let idx = lower.indexOf(term)
          while (idx !== -1) {
            let negated = false
            if (compiled.negation) {
              // Optimized negation check - avoid slice when possible
              const checkStart = Math.max(0, idx - 15)
              if (checkStart < idx) {
                const before = lower.slice(checkStart, idx)
                negated = NEGATION.some(n => before.endsWith(n))
              }
            }
            if (!negated) {
              found = true
              if (collectMatches) {
                allMatches.push({ 
                  noteId: note.id, 
                  term: note.text.slice(idx, idx + term.length), 
                  start: idx, 
                  end: idx + term.length,
                  questionId: qid
                })
              } else if (found) {
                // Early exit if we just need to know if note matches
                break
              }
            }
            idx = lower.indexOf(term, idx + 1)
          }
          // Early exit from term loop if found and not collecting
          if (found && !collectMatches) break
        }

        // Check pre-compiled regexes (skip if already found and not collecting)
        if (!found || collectMatches) {
          for (const re of compiled.regexes) {
            // Reset regex lastIndex for reuse
            re.lastIndex = 0
            let m
            while ((m = re.exec(note.text)) !== null) {
              found = true
              if (collectMatches) {
                allMatches.push({ 
                  noteId: note.id, 
                  term: m[0], 
                  start: m.index, 
                  end: m.index + m[0].length,
                  questionId: qid
                })
              } else {
                break // Early exit
              }
            }
            if (found && !collectMatches) break
          }
        }
        
        // Early exit from question loop if found and not collecting
        if (found && !collectMatches) break
      }
      
      if (found) matching.add(note.id)
    }
    return { matchingNotes: matching, matches: allMatches, excludedCount: excluded, modelMatchCount: modelMatches }
  }, [notes, selected, compiledPatterns, excludes, minLen, autoTag, useModel, modelEntities])

  function toggle(qid: string) {
    const next = new Set(selected)
    if (next.has(qid)) next.delete(qid)
    else next.add(qid)
    setSelected(next)
  }

  function expand(qid: string) {
    setExpanded(expanded === qid ? null : qid)
    setNewTerm('')
  }

  function addTerm(qid: string) {
    if (!newTerm.trim()) return
    const config = patterns[qid]
    if (!config) return
    const updated = { ...patterns, [qid]: { ...config, terms: [...config.terms, newTerm.trim()] } }
    savePatterns(updated)
    setNewTerm('')
  }

  function removeTerm(qid: string, idx: number) {
    const config = patterns[qid]
    if (!config) return
    const updated = { ...patterns, [qid]: { ...config, terms: config.terms.filter((_, i) => i !== idx) } }
    savePatterns(updated)
  }

  function addRegex(qid: string) {
    const rx = prompt('Add regex pattern (e.g., \\d+\\s*mm):')
    if (!rx) return
    const config = patterns[qid]
    if (!config) return
    const updated = { ...patterns, [qid]: { ...config, regex: [...config.regex, rx] } }
    savePatterns(updated)
  }

  function removeRegex(qid: string, idx: number) {
    const config = patterns[qid]
    if (!config) return
    const updated = { ...patterns, [qid]: { ...config, regex: config.regex.filter((_, i) => i !== idx) } }
    savePatterns(updated)
  }

  function toggleNegation(qid: string) {
    const config = patterns[qid]
    if (!config) return
    const updated = { ...patterns, [qid]: { ...config, negation: !config.negation } }
    savePatterns(updated)
  }

  function resetAll() {
    savePatterns(DEFAULT_PATTERNS)
    setSelected(new Set())
    setExcludes('')
    setMinLen('')
  }

  function apply() {
    onApply(matchingNotes, autoTag ? matches : undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-maple-800 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between px-4 py-2 border-b border-maple-200 dark:border-maple-800">
          <span className="text-sm font-medium text-maple-700 dark:text-maple-200">Find Notes</span>
          <div className="flex items-center gap-3">
            <button onClick={resetAll} className="text-[10px] text-maple-400 hover:text-maple-600">Reset</button>
            <button onClick={onClose}><X size={16} className="text-maple-400" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {questions.map(q => {
            const config = patterns[q.id]
            const isActive = selected.has(q.id)
            const isExpanded = expanded === q.id
            
            return (
              <div key={q.id} className="mb-1">
                <div className={`flex items-center gap-2 p-2 rounded-lg ${isActive ? 'bg-maple-50 dark:bg-maple-700/50' : ''}`}>
                  <button
                    onClick={() => toggle(q.id)}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'text-white' : 'text-white/70'
                    }`}
                    style={{ backgroundColor: q.color }}
                  >
                    {isActive ? <Check size={12} /> : q.hotkey}
                  </button>
                  
                  <button onClick={() => toggle(q.id)} className="flex-1 text-left text-[11px] font-medium text-maple-700 dark:text-maple-200">
                    {q.name}
                  </button>
                  
                  {config?.negation && <span className="text-[8px] px-1 py-0.5 bg-amber-100 text-amber-600 rounded-full">neg</span>}
                  
                  <button onClick={() => expand(q.id)} className="p-1 text-maple-400 hover:text-maple-600">
                    <ChevronRight size={12} className={isExpanded ? 'rotate-90' : ''} />
                  </button>
                </div>

                {isExpanded && config && (
                  <div className="ml-7 mr-2 mb-2 p-2 bg-maple-50 dark:bg-maple-700/30 rounded-lg text-[10px] space-y-2">
                    {/* Model option for Q6 (Radiology) */}
                    {q.id === 'Q6' && (
                      <div className="p-2 bg-maple-100 dark:bg-maple-700/50 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-maple-700 dark:text-maple-200 font-medium">BiLSTM Span Model</span>
                          </div>
                          {!useModel ? (
                            <button
                              onClick={runModelInference}
                              className="btn btn-xs btn-primary"
                            >
                              Run Model
                            </button>
                          ) : (
                            <button
                              onClick={clearModelResults}
                              className="btn btn-xs btn-secondary"
                            >
                              Clear Results
                            </button>
                          )}
                        </div>
                        {useModel && modelEntities.size > 0 && (
                          <div className="text-[9px] text-maple-600 dark:text-maple-300 flex items-center gap-1">
                            <Check size={10} />
                            {modelEntities.size} notes with entities detected
                          </div>
                        )}
                        {modelError && (
                          <div className="text-red-500 text-[9px]">{modelError}</div>
                        )}
                      </div>
                    )}
                    
                    {/* Terms */}
                    <div>
                      <div className="text-maple-500 mb-1">Terms:</div>
                      <div className="flex flex-wrap gap-1">
                        {config.terms.map((t, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-maple-800 rounded-full">
                            {t}
                            <button onClick={() => removeTerm(q.id, i)} className="text-maple-400 hover:text-red-500"><X size={8} /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1 mt-1">
                        <input
                          value={newTerm}
                          onChange={e => setNewTerm(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addTerm(q.id)}
                          placeholder="Add term..."
                          className="flex-1 px-1.5 py-0.5 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded-lg text-[10px] dark:text-maple-200"
                        />
                        <button onClick={() => addTerm(q.id)} className="px-1.5 py-0.5 bg-maple-600 text-white rounded-full"><Plus size={10} /></button>
                      </div>
                    </div>

                    {/* Regex */}
                    <div>
                      <div className="text-maple-500 mb-1">Patterns (regex):</div>
                      <div className="flex flex-wrap gap-1">
                        {config.regex.map((r, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-maple-100 dark:bg-maple-700 text-maple-700 dark:text-maple-200 rounded-full font-mono text-[9px]">
                            {r}
                            <button onClick={() => removeRegex(q.id, i)} className="text-maple-400 hover:text-red-500"><X size={8} /></button>
                          </span>
                        ))}
                        <button onClick={() => addRegex(q.id)} className="px-1.5 py-0.5 text-maple-600 dark:text-maple-300 hover:bg-maple-100 dark:hover:bg-maple-700/50 rounded-full">+ regex</button>
                      </div>
                    </div>

                    {/* Negation toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={config.negation} onChange={() => toggleNegation(q.id)} className="rounded border-maple-300 text-amber-600 w-3 h-3" />
                      <span className="text-maple-500">Skip negated (no, denies, without)</span>
                    </label>
                  </div>
                )}

              </div>
            )
          })}

          {/* Excludes */}
          <div className="mt-3 pt-3 border-t border-maple-100 dark:border-maple-800">
            <div className="flex items-center gap-2 mb-2">
              <Ban size={12} className="text-maple-400" />
              <span className="text-[10px] text-maple-500">Exclude notes containing:</span>
            </div>
            <input
              value={excludes}
              onChange={e => setExcludes(e.target.value)}
              placeholder="telephone, physical therapy, short order..."
              className="w-full px-2 py-1 text-[10px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded-lg dark:text-maple-200"
            />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-maple-500">Min chars:</span>
              <input
                value={minLen}
                onChange={e => setMinLen(e.target.value)}
                placeholder="0"
                className="w-16 px-2 py-1 text-[10px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded-lg dark:text-maple-200"
              />
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-t border-maple-100 dark:border-maple-800">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoTag} onChange={e => setAutoTag(e.target.checked)} className="rounded border-maple-300 text-maple-600" />
            <span className="text-[10px] text-maple-600 dark:text-maple-300">Auto-tag matches with their question</span>
          </label>
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t border-maple-200 dark:border-maple-800 bg-maple-50 dark:bg-maple-700/50">
          <span className="text-[11px]">
            <b className="text-maple-700 dark:text-maple-200">{matchingNotes.size}</b>
            <span className="text-maple-400"> / {notes.length} notes</span>
            {excludedCount > 0 && <span className="text-maple-400"> ({excludedCount} excluded)</span>}
            {useModel && modelMatchCount > 0 && (
              <span className="text-maple-500 dark:text-maple-400 ml-1">
                ({modelMatchCount} via model)
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {onDeleteNonMatching && matchingNotes.size > 0 && matchingNotes.size < notes.length && (
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="btn btn-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                title="Permanently delete notes that don't match filter"
              >
                <Trash2 size={10} /> Delete {notes.length - matchingNotes.size}
              </button>
            )}
            <button onClick={apply} className="btn btn-sm btn-primary">
              <Search size={11} /> Filter
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Non-Matching Notes"
        message={`This will permanently delete ${notes.length - matchingNotes.size} notes that don't match the current filter.\n\nThis action cannot be undone.`}
        confirmText={`Delete ${notes.length - matchingNotes.size} Notes`}
        variant="danger"
        onConfirm={() => {
          // Auto-tag first if enabled, then delete
          if (autoTag && matches.length > 0) {
            onApply(matchingNotes, matches)
          }
          onDeleteNonMatching?.(matchingNotes)
          setShowDeleteConfirm(false)
          onClose()
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Model Analysis Progress Modal */}
      {showModelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={e => e.stopPropagation()}>
          <div className="bg-white dark:bg-maple-800 rounded-xl shadow-xl p-6 w-80 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-maple-100 dark:bg-maple-700 rounded-full" />
              <div>
                <h3 className="font-medium text-maple-800 dark:text-maple-100">Model analysis</h3>
                <p className="text-[11px] text-maple-500">Detecting radiology entities</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-maple-600 dark:text-maple-300">{modelProgress.status}</span>
                <span className="text-maple-400">
                  {modelProgress.current} / {modelProgress.total}
                </span>
              </div>
              
              <div className="h-2 bg-maple-100 dark:bg-maple-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-maple-600 transition-all duration-300"
                  style={{ width: `${modelProgress.total ? (modelProgress.current / modelProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            {modelError && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-[11px] text-red-600 dark:text-red-400">
                {modelError}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              {modelLoading ? (
                <button
                  onClick={cancelModelInference}
                  className="btn btn-sm btn-secondary"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => setShowModelModal(false)}
                  className="btn btn-sm btn-primary"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
