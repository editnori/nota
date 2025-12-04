import { useState, useMemo, useCallback } from 'react'
import { useStore } from '../hooks/useStore'
import { useDebounce } from '../hooks/useDebounce'
import { Search, ChevronUp, ChevronDown, Filter, X, Loader2, Sliders } from 'lucide-react'
import { SmartFilter } from './SmartFilter'

const PAGE_SIZE = 50

export function NotesList() {
  const { notes, annotations, currentNoteIndex, setCurrentNoteIndex } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'done' | 'todo'>('all')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showSmartFilter, setShowSmartFilter] = useState(false)
  const [smartFilterIds, setSmartFilterIds] = useState<Set<string> | null>(null)
  const [page, setPage] = useState(0)

  // Debounce search for performance with large datasets
  const debouncedSearch = useDebounce(search, 200)
  const isSearching = search !== debouncedSearch

  // Memoize annotation counts for performance with large datasets
  const annotationCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of annotations) {
      counts.set(a.noteId, (counts.get(a.noteId) || 0) + 1)
    }
    return counts
  }, [annotations])

  const suggestedNotes = useMemo(() => {
    const set = new Set<string>()
    for (const a of annotations) {
      if (a.source === 'suggested') set.add(a.noteId)
    }
    return set
  }, [annotations])

  // Get unique note types
  const noteTypes = useMemo(() => {
    const types = new Set<string>()
    for (const note of notes) {
      if (note.meta?.type) types.add(note.meta.type)
    }
    return Array.from(types).sort()
  }, [notes])

  // Build search index for faster lookups
  const searchIndex = useMemo(() => {
    if (notes.length < 500) return null // Only build index for large datasets
    
    const index = new Map<string, Set<number>>()
    
    notes.forEach((note, idx) => {
      // Index note ID words
      const idWords = note.id.toLowerCase().split(/\W+/)
      for (const word of idWords) {
        if (word.length < 2) continue
        if (!index.has(word)) index.set(word, new Set())
        index.get(word)!.add(idx)
      }
      
      // Index first 500 chars of text (for performance)
      const textSample = note.text.slice(0, 500).toLowerCase()
      const textWords = textSample.split(/\W+/)
      for (const word of textWords) {
        if (word.length < 3) continue
        if (!index.has(word)) index.set(word, new Set())
        index.get(word)!.add(idx)
      }
    })
    
    return index
  }, [notes])

  // Filter notes - memoized for performance
  const filtered = useMemo(() => {
    let candidates = notes
    
    // Apply smart filter first if active
    if (smartFilterIds) {
      candidates = candidates.filter(n => smartFilterIds.has(n.id))
    }
    
    // Use index for search if available
    if (debouncedSearch && searchIndex && !smartFilterIds) {
      const searchLower = debouncedSearch.toLowerCase()
      const searchWords = searchLower.split(/\W+/).filter(w => w.length >= 2)
      
      if (searchWords.length > 0) {
        // Find notes matching any search word
        const matchingIndices = new Set<number>()
        for (const word of searchWords) {
          // Find index entries that start with the search word
          for (const [indexWord, indices] of searchIndex) {
            if (indexWord.startsWith(word) || indexWord.includes(word)) {
              indices.forEach(idx => matchingIndices.add(idx))
            }
          }
        }
        candidates = Array.from(matchingIndices).map(idx => notes[idx])
      }
    }
    
    const searchLower = debouncedSearch.toLowerCase()
    
    return candidates.filter(note => {
      // Type filter
      if (typeFilter && note.meta?.type !== typeFilter) return false
      
      // Search filter (if not using index or for refinement)
      if (debouncedSearch && !searchIndex) {
        if (!note.id.toLowerCase().includes(searchLower) && 
            !note.text.toLowerCase().includes(searchLower)) {
          return false
        }
      }
      
      // Status filter
      const count = annotationCounts.get(note.id) || 0
      if (filter === 'done' && count === 0) return false
      if (filter === 'todo' && count > 0) return false
      
      return true
    })
  }, [notes, debouncedSearch, filter, typeFilter, annotationCounts, searchIndex, smartFilterIds])

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = useMemo(() => {
    return filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  }, [filtered, page])
  
  // Keep page in bounds when filter changes
  useMemo(() => {
    if (page >= totalPages && totalPages > 0) {
      setPage(totalPages - 1)
    }
  }, [totalPages, page])

  // Jump to page containing current note
  const jumpToCurrent = useCallback(() => {
    const currentNote = notes[currentNoteIndex]
    if (!currentNote) return
    const idx = filtered.findIndex(n => n.id === currentNote.id)
    if (idx >= 0) {
      setPage(Math.floor(idx / PAGE_SIZE))
    }
  }, [notes, currentNoteIndex, filtered])

  const annotatedCount = useMemo(() => {
    return notes.filter(n => annotationCounts.get(n.id)).length
  }, [notes, annotationCounts])

  // Get count for a type
  const getTypeCount = useCallback((type: string) => {
    return notes.filter(n => n.meta?.type === type).length
  }, [notes])

  function handleSmartFilterApply(ids: Set<string>) {
    setSmartFilterIds(ids)
    setPage(0)
  }

  function clearSmartFilter() {
    setSmartFilterIds(null)
    setPage(0)
  }

  return (
    <aside className="w-52 bg-white dark:bg-maple-800 border-r border-maple-200 dark:border-maple-700 flex flex-col">
      <div className="p-2 space-y-2 border-b border-maple-100 dark:border-maple-700">
        {/* Smart Filter button */}
        <button
          onClick={() => setShowSmartFilter(true)}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] rounded border transition-all ${
            smartFilterIds
              ? 'bg-maple-100 dark:bg-maple-700 border-maple-400 dark:border-maple-500 text-maple-700 dark:text-maple-200 font-medium'
              : 'border-maple-200 dark:border-maple-600 text-maple-500 dark:text-maple-400 hover:bg-maple-50 dark:hover:bg-maple-700'
          }`}
        >
          <Sliders size={12} />
          {smartFilterIds ? `Filtered: ${smartFilterIds.size}` : 'Smart Filter'}
        </button>

        {/* Active smart filter indicator */}
        {smartFilterIds && (
          <div className="flex items-center gap-1 bg-maple-100 dark:bg-maple-700 text-maple-600 dark:text-maple-300 rounded px-2 py-1">
            <span className="text-[9px] flex-1">{smartFilterIds.size} of {notes.length} notes</span>
            <button onClick={clearSmartFilter} className="hover:text-maple-800 dark:hover:text-maple-100">
              <X size={10} />
            </button>
          </div>
        )}

        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-maple-400 dark:text-maple-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search notes..."
            className="w-full pl-7 pr-7 py-1 text-[11px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded focus:outline-none focus:border-maple-400 dark:text-maple-200"
          />
          {isSearching && (
            <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-maple-400 animate-spin" />
          )}
        </div>
        
        <div className="flex gap-1">
          <div className="flex flex-1 text-[9px] border border-maple-200 dark:border-maple-600 rounded overflow-hidden">
            {(['all', 'done', 'todo'] as const).map(f => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(0) }}
                className={`flex-1 py-1 capitalize ${filter === f ? 'bg-maple-800 dark:bg-maple-600 text-white' : 'text-maple-500 dark:text-maple-400 hover:bg-maple-50 dark:hover:bg-maple-700'}`}
              >
                {f}
              </button>
            ))}
          </div>
          
          {noteTypes.length > 0 && (
            <button
              onClick={() => setShowTypeFilter(!showTypeFilter)}
              className={`p-1 rounded border ${
                typeFilter || showTypeFilter
                  ? 'bg-maple-100 dark:bg-maple-700 border-maple-300 dark:border-maple-600 text-maple-600 dark:text-maple-300'
                  : 'border-maple-200 dark:border-maple-600 text-maple-500 dark:text-maple-400 hover:bg-maple-50 dark:hover:bg-maple-700'
              }`}
              title="Filter by note type"
            >
              <Filter size={12} />
            </button>
          )}
        </div>

        {/* Type filter dropdown */}
        {showTypeFilter && noteTypes.length > 0 && (
          <div className="bg-maple-50 dark:bg-maple-700 rounded border border-maple-200 dark:border-maple-600 p-1.5">
            <div className="text-[9px] text-maple-500 dark:text-maple-400 mb-1 px-1">Note types:</div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              <button
                onClick={() => { setTypeFilter(null); setPage(0) }}
                className={`w-full text-left px-1.5 py-1 text-[10px] rounded flex justify-between ${
                  !typeFilter ? 'bg-white dark:bg-maple-600 font-medium' : 'hover:bg-white dark:hover:bg-maple-600'
                }`}
              >
                <span className="dark:text-maple-200">All types</span>
                <span className="text-maple-400 dark:text-maple-500">{notes.length}</span>
              </button>
              {noteTypes.map(type => (
                <button
                  key={type}
                  onClick={() => { setTypeFilter(type); setPage(0) }}
                  className={`w-full text-left px-1.5 py-1 text-[10px] rounded flex justify-between ${
                    typeFilter === type ? 'bg-white dark:bg-maple-600 font-medium' : 'hover:bg-white dark:hover:bg-maple-600'
                  }`}
                >
                  <span className="dark:text-maple-200 truncate">{type}</span>
                  <span className="text-maple-400 dark:text-maple-500 ml-1">{getTypeCount(type)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active type filter badge */}
        {typeFilter && !showTypeFilter && (
          <div className="flex items-center gap-1 bg-maple-100 dark:bg-maple-700 text-maple-600 dark:text-maple-300 rounded px-2 py-1">
            <span className="text-[9px] truncate flex-1">{typeFilter}</span>
            <button onClick={() => setTypeFilter(null)} className="hover:text-maple-800 dark:hover:text-maple-100">
              <X size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Pagination header */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-2 py-1 bg-maple-50 dark:bg-maple-700/50 border-b border-maple-100 dark:border-maple-700">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-0.5 rounded hover:bg-maple-200 dark:hover:bg-maple-600 disabled:opacity-30"
          >
            <ChevronUp size={12} />
          </button>
          <button 
            onClick={jumpToCurrent}
            className="text-[9px] text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
            title="Jump to current note"
          >
            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-0.5 rounded hover:bg-maple-200 dark:hover:bg-maple-600 disabled:opacity-30"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {paged.map((note) => {
          const originalIndex = notes.findIndex(n => n.id === note.id)
          const selected = originalIndex === currentNoteIndex
          const count = annotationCounts.get(note.id) || 0
          const hasSuggested = suggestedNotes.has(note.id)

          return (
            <button
              key={note.id}
              onClick={() => setCurrentNoteIndex(originalIndex)}
              className={`w-full text-left px-2 py-2 border-b border-maple-100 dark:border-maple-700 ${
                selected ? 'bg-maple-100 dark:bg-maple-700' : 'hover:bg-maple-50 dark:hover:bg-maple-700/50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[9px] tabular-nums ${selected ? 'text-maple-600 dark:text-maple-300 font-medium' : 'text-maple-400 dark:text-maple-500'}`}>
                  {originalIndex + 1}
                </span>
                <span className={`text-[10px] truncate flex-1 ${selected ? 'text-maple-900 dark:text-maple-100 font-medium' : 'text-maple-600 dark:text-maple-300'}`}>
                  {note.id}
                </span>
                {count > 0 && (
                  <span className={`text-[8px] px-1 py-0.5 rounded-full font-medium ${hasSuggested ? 'bg-maple-200 dark:bg-maple-600 text-maple-600 dark:text-maple-300' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'}`}>
                    {count}
                  </span>
                )}
              </div>
              {note.meta?.type && (
                <div className="text-[8px] text-maple-400 dark:text-maple-500 mb-0.5">{note.meta.type}</div>
              )}
              <div className="text-[9px] text-maple-400 dark:text-maple-500 truncate leading-tight">
                {note.text.slice(0, 50)}...
              </div>
            </button>
          )
        })}
        
        {paged.length === 0 && (
          <div className="p-4 text-center text-[10px] text-maple-400 dark:text-maple-500">
            {search || typeFilter || smartFilterIds ? 'No matches' : 'No notes'}
          </div>
        )}
      </div>

      <div className="p-1.5 border-t border-maple-100 dark:border-maple-700 text-[9px] text-maple-400 dark:text-maple-500 text-center">
        {annotatedCount}/{notes.length} done
      </div>

      {/* Smart Filter Modal */}
      {showSmartFilter && (
        <SmartFilter
          notes={notes}
          onApply={handleSmartFilterApply}
          onClose={() => setShowSmartFilter(false)}
        />
      )}
    </aside>
  )
}
