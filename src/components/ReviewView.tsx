import { useState, useMemo } from 'react'
import { useStore } from '../hooks/useStore'
import { useDebounce } from '../hooks/useDebounce'
import { loadQuestions, getQuestion } from '../lib/questions'
import { X, ExternalLink, Search, Wand2, Loader2 } from 'lucide-react'

const PAGE_SIZE = 50

export function ReviewView() {
  const { notes, annotations, removeAnnotation, setMode, setCurrentNoteIndex, addBulkAnnotations } = useStore()
  const [selectedQ, setSelectedQ] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [showBulkTag, setShowBulkTag] = useState(false)
  const [bulkSearch, setBulkSearch] = useState('')
  const [excludedMatches, setExcludedMatches] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [highlightedNote, setHighlightedNote] = useState<string | null>(null)
  const questions = loadQuestions()

  // Debounce searches
  const debouncedSearchText = useDebounce(searchText, 200)
  const debouncedBulkSearch = useDebounce(bulkSearch, 300)
  const isSearching = searchText !== debouncedSearchText
  const isBulkSearching = bulkSearch !== debouncedBulkSearch

  const noteMap = useMemo(() => new Map(notes.map(n => [n.id, n])), [notes])

  // Count annotations per question
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    questions.forEach(q => map.set(q.id, 0))
    annotations.forEach(ann => {
      ann.questions.forEach(qid => {
        map.set(qid, (map.get(qid) || 0) + 1)
      })
    })
    return map
  }, [annotations, questions])

  // Filter annotations
  const filteredAnnotations = useMemo(() => {
    let filtered = annotations
    if (selectedQ) {
      filtered = filtered.filter(a => a.questions.includes(selectedQ))
    }
    if (debouncedSearchText.trim()) {
      const lower = debouncedSearchText.toLowerCase()
      filtered = filtered.filter(a => a.text.toLowerCase().includes(lower))
    }
    return filtered
  }, [annotations, selectedQ, debouncedSearchText])

  // Pagination
  const totalPages = Math.ceil(filteredAnnotations.length / PAGE_SIZE)
  const pagedAnnotations = filteredAnnotations.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Bulk tag matches - optimized with early termination
  const bulkMatches = useMemo(() => {
    if (!debouncedBulkSearch.trim()) return []
    
    const lower = debouncedBulkSearch.toLowerCase()
    const matches: { id: string, noteId: string, text: string, start: number, end: number, contextBefore: string, contextAfter: string }[] = []
    
    // Build set of already-tagged positions for fast lookup
    const taggedPositions = new Set<string>()
    for (const a of annotations) {
      taggedPositions.add(`${a.noteId}:${a.start}:${a.end}`)
    }
    
    for (const note of notes) {
      // Only search first occurrence per note for very large searches
      let idx = 0
      let matchCount = 0
      const maxMatchesPerNote = 10 // Limit matches per note for performance
      
      while (idx < note.text.length && matchCount < maxMatchesPerNote) {
        const foundIdx = note.text.toLowerCase().indexOf(lower, idx)
        if (foundIdx === -1) break
        
        const posKey = `${note.id}:${foundIdx}:${foundIdx + debouncedBulkSearch.length}`
        
        if (!taggedPositions.has(posKey)) {
          const ctxLen = 25
          matches.push({
            id: `${note.id}_${foundIdx}`,
            noteId: note.id,
            text: note.text.slice(foundIdx, foundIdx + debouncedBulkSearch.length),
            start: foundIdx,
            end: foundIdx + debouncedBulkSearch.length,
            contextBefore: note.text.slice(Math.max(0, foundIdx - ctxLen), foundIdx),
            contextAfter: note.text.slice(foundIdx + debouncedBulkSearch.length, foundIdx + debouncedBulkSearch.length + ctxLen)
          })
          matchCount++
        }
        idx = foundIdx + 1
      }
      
      // Early termination if we have too many matches
      if (matches.length >= 500) break
    }
    
    return matches
  }, [debouncedBulkSearch, notes, annotations])

  // Active matches (excluding deselected ones)
  const activeMatches = useMemo(() => {
    return bulkMatches.filter(m => !excludedMatches.has(m.id))
  }, [bulkMatches, excludedMatches])

  function goToNote(noteId: string) {
    const idx = notes.findIndex(n => n.id === noteId)
    if (idx >= 0) {
      setCurrentNoteIndex(idx)
      setMode('annotate')
      setHighlightedNote(noteId)
      setTimeout(() => setHighlightedNote(null), 1500)
    }
  }

  function toggleMatch(matchId: string) {
    setExcludedMatches(prev => {
      const next = new Set(prev)
      if (next.has(matchId)) {
        next.delete(matchId)
      } else {
        next.add(matchId)
      }
      return next
    })
  }

  function handleBulkTag(questionId: string) {
    if (activeMatches.length === 0) return
    if (!confirm(`Tag ${activeMatches.length} matches as "${getQuestion(questionId)?.name}"?`)) return
    
    addBulkAnnotations(activeMatches.map(m => ({
      noteId: m.noteId,
      start: m.start,
      end: m.end,
      text: m.text,
      questions: [questionId]
    })))
    setBulkSearch('')
    setExcludedMatches(new Set())
    setShowBulkTag(false)
  }

  const manualCount = annotations.filter(a => a.source !== 'suggested').length
  const suggestedCount = annotations.filter(a => a.source === 'suggested').length

  return (
    <div className="flex-1 flex">
      {/* Sidebar */}
      <aside className="w-48 bg-white dark:bg-maple-800 border-r border-maple-200 dark:border-maple-700 flex flex-col">
        <div className="p-2 border-b border-maple-100 dark:border-maple-700">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-maple-400" />
            <input
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setPage(0) }}
              placeholder="Search..."
              className="w-full pl-7 pr-7 py-1 text-[10px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded focus:outline-none dark:text-maple-200"
            />
            {isSearching && (
              <Loader2 size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-maple-400 animate-spin" />
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => { setSelectedQ(null); setPage(0) }}
            className={`w-full text-left px-2 py-2 text-[11px] flex justify-between ${
              !selectedQ ? 'bg-maple-100 dark:bg-maple-700 font-medium' : 'hover:bg-maple-50 dark:hover:bg-maple-700'
            }`}
          >
            <span className="dark:text-maple-200">All</span>
            <span className="text-maple-400 dark:text-maple-500">{annotations.length}</span>
          </button>
          
          {questions.map(q => {
            const count = counts.get(q.id) || 0
            return (
              <button
                key={q.id}
                onClick={() => { setSelectedQ(q.id); setPage(0) }}
                className={`w-full text-left px-2 py-1.5 flex items-center gap-2 ${
                  selectedQ === q.id ? 'bg-maple-50 dark:bg-maple-700' : 'hover:bg-maple-50 dark:hover:bg-maple-700'
                }`}
              >
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white" style={{ backgroundColor: q.color }}>
                  {q.hotkey}
                </span>
                <span className={`text-[10px] flex-1 truncate dark:text-maple-200 ${selectedQ === q.id ? 'font-medium' : ''}`}>
                  {q.name}
                </span>
                <span className={`text-[9px] ${count ? 'text-maple-600 dark:text-maple-300' : 'text-maple-300 dark:text-maple-600'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="p-2 border-t border-maple-100 dark:border-maple-700 space-y-1">
          <button
            onClick={() => { setShowBulkTag(!showBulkTag); setExcludedMatches(new Set()); setBulkSearch('') }}
            className={`w-full flex items-center gap-1.5 px-2 py-1 text-[9px] rounded ${
              showBulkTag ? 'bg-maple-200 dark:bg-maple-600 text-maple-700 dark:text-maple-200' : 'text-maple-500 dark:text-maple-400 hover:bg-maple-50 dark:hover:bg-maple-700'
            }`}
          >
            <Wand2 size={11} />
            Search & Tag
          </button>
          <div className="text-[9px] text-maple-400 dark:text-maple-500 text-center">
            {manualCount} manual{suggestedCount > 0 && ` + ${suggestedCount} auto`}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-3 bg-maple-50 dark:bg-maple-900">
        {/* Bulk tag panel */}
        {showBulkTag && (
          <div className="max-w-2xl mx-auto mb-3 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 size={14} className="text-maple-600 dark:text-maple-300" />
              <span className="text-[11px] font-medium text-maple-700 dark:text-maple-200">Search & Tag</span>
            </div>
            <div className="relative">
              <input
                value={bulkSearch}
                onChange={e => { setBulkSearch(e.target.value); setExcludedMatches(new Set()) }}
                placeholder="Enter text to find across all notes..."
                className="w-full px-2 py-1.5 pr-8 text-[11px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded focus:outline-none dark:text-maple-200 mb-2"
                autoFocus
              />
              {isBulkSearching && (
                <Loader2 size={12} className="absolute right-2 top-2 text-maple-400 animate-spin" />
              )}
            </div>
            
            {bulkMatches.length > 0 && !isBulkSearching && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-maple-600 dark:text-maple-300">
                    {activeMatches.length} of {bulkMatches.length} selected
                    {excludedMatches.size > 0 && (
                      <button 
                        onClick={() => setExcludedMatches(new Set())}
                        className="ml-2 text-maple-500 hover:text-maple-700 dark:hover:text-maple-200 underline"
                      >
                        reset
                      </button>
                    )}
                    {bulkMatches.length >= 500 && (
                      <span className="ml-2 text-maple-400">(limited to 500)</span>
                    )}
                  </span>
                </div>
                
                {/* Match list with checkboxes */}
                <div className="max-h-64 overflow-y-auto mb-3 space-y-0.5 bg-maple-50 dark:bg-maple-700 rounded border border-maple-100 dark:border-maple-600">
                  {bulkMatches.map((m) => {
                    const isExcluded = excludedMatches.has(m.id)
                    return (
                      <div 
                        key={m.id}
                        onClick={() => toggleMatch(m.id)}
                        className={`flex items-start gap-2 px-2 py-1.5 cursor-pointer border-b border-maple-100 dark:border-maple-600 last:border-0 ${
                          isExcluded ? 'opacity-40 bg-maple-100 dark:bg-maple-800' : 'hover:bg-white dark:hover:bg-maple-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={() => toggleMatch(m.id)}
                          className="mt-0.5 accent-maple-600"
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-mono text-maple-600 dark:text-maple-300 leading-tight">
                            <span className="text-maple-400 dark:text-maple-500">...{m.contextBefore}</span>
                            <mark className={`px-0.5 rounded ${isExcluded ? 'bg-maple-200 dark:bg-maple-600' : 'bg-maple-300 dark:bg-maple-500'}`}>
                              {m.text}
                            </mark>
                            <span className="text-maple-400 dark:text-maple-500">{m.contextAfter}...</span>
                          </div>
                          <div className="text-[9px] text-maple-400 dark:text-maple-500 mt-0.5">{m.noteId}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] text-maple-600 dark:text-maple-300 mr-1">Tag as:</span>
                  {questions.map(q => (
                    <button
                      key={q.id}
                      onClick={() => handleBulkTag(q.id)}
                      disabled={activeMatches.length === 0}
                      className="text-[9px] px-2 py-0.5 rounded text-white hover:opacity-80 disabled:opacity-40"
                      style={{ backgroundColor: q.color }}
                    >
                      {q.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            {bulkSearch && bulkMatches.length === 0 && !isBulkSearching && (
              <div className="text-[10px] text-maple-500 dark:text-maple-400">No new matches</div>
            )}
          </div>
        )}

        {/* Pagination */}
        {filteredAnnotations.length > PAGE_SIZE && (
          <div className="max-w-2xl mx-auto mb-2 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-700 disabled:opacity-30"
            >
              Prev
            </button>
            <span className="text-[10px] text-maple-500 dark:text-maple-400">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredAnnotations.length)} of {filteredAnnotations.length}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-700 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}

        {/* Annotations list */}
        {pagedAnnotations.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-[11px] text-maple-400 dark:text-maple-500">
              {searchText || selectedQ ? 'No matches' : 'No annotations yet'}
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-2">
            {pagedAnnotations.map(ann => {
              const note = noteMap.get(ann.noteId)
              const ctx = 40
              const before = note?.text.slice(Math.max(0, ann.start - ctx), ann.start) || ''
              const after = note?.text.slice(ann.end, ann.end + ctx) || ''
              const isSuggested = ann.source === 'suggested'
              const isHighlighted = highlightedNote === ann.noteId

              return (
                <div 
                  key={ann.id} 
                  className={`bg-white dark:bg-maple-800 border rounded-lg p-3 transition-all ${
                    isSuggested ? 'border-maple-300 dark:border-maple-600 border-dashed' : 'border-maple-200 dark:border-maple-700'
                  } ${isHighlighted ? 'ring-2 ring-maple-400 ring-offset-2' : ''}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex flex-wrap gap-1 flex-1">
                      {ann.questions.map(qid => {
                        const q = getQuestion(qid)
                        return (
                          <span
                            key={qid}
                            className="text-[9px] px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: q?.color || '#888' }}
                          >
                            {q?.name || qid}
                          </span>
                        )
                      })}
                      {isSuggested && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-maple-100 dark:bg-maple-700 text-maple-500 dark:text-maple-400 border border-maple-200 dark:border-maple-600 border-dashed">
                          auto
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => goToNote(ann.noteId)}
                      className="p-1 text-maple-400 hover:text-maple-600 dark:hover:text-maple-300 hover:bg-maple-50 dark:hover:bg-maple-700 rounded"
                      title="View"
                    >
                      <ExternalLink size={12} />
                    </button>
                    <button
                      onClick={() => removeAnnotation(ann.id)}
                      className="p-1 text-maple-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Delete"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  
                  <div className="text-[10px] text-maple-600 dark:text-maple-300 font-mono leading-relaxed">
                    <span className="text-maple-400 dark:text-maple-500">...{before}</span>
                    <mark 
                      className="px-0.5 rounded"
                      style={{ 
                        backgroundColor: `${getQuestion(ann.questions[0])?.color}25`,
                        color: getQuestion(ann.questions[0])?.color 
                      }}
                    >
                      {ann.text}
                    </mark>
                    <span className="text-maple-400 dark:text-maple-500">{after}...</span>
                  </div>

                  <div className="mt-1.5 text-[9px] text-maple-400 dark:text-maple-500">
                    {ann.noteId}
                    {ann.comment && <span className="ml-2 italic">"{ann.comment}"</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
