import { useState, useMemo, useCallback, memo } from 'react'
import { useStore } from '../hooks/useStore'
import { useDebounce } from '../hooks/useDebounce'
import { Search, ChevronUp, ChevronDown, Filter, X, Loader2, Zap } from 'lucide-react'
import { SmartFilter } from './SmartFilter'
import type { Note } from '../lib/types'

const PAGE_SIZE = 50

// Memoized note item to prevent re-renders
const NoteItem = memo(function NoteItem({ 
  note, 
  index, 
  isSelected, 
  annotationCount, 
  hasSuggested,
  onClick 
}: {
  note: Note
  index: number
  isSelected: boolean
  annotationCount: number
  hasSuggested: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-2 border-b border-maple-100 dark:border-maple-700 ${
        isSelected ? 'bg-maple-100 dark:bg-maple-700' : 'hover:bg-maple-50 dark:hover:bg-maple-700/50'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`text-[9px] tabular-nums ${isSelected ? 'text-maple-600 dark:text-maple-300 font-medium' : 'text-maple-400 dark:text-maple-500'}`}>
          {index + 1}
        </span>
        <span className={`text-[10px] truncate flex-1 ${isSelected ? 'text-maple-900 dark:text-maple-100 font-medium' : 'text-maple-600 dark:text-maple-300'}`}>
          {note.id}
        </span>
        {annotationCount > 0 && (
          <span className={`text-[8px] px-1 py-0.5 rounded-full font-medium ${hasSuggested ? 'bg-maple-200 dark:bg-maple-600 text-maple-600 dark:text-maple-300' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'}`}>
            {annotationCount}
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
})

interface MatchLocation {
  noteId: string
  term: string
  start: number
  end: number
  questionId: string
}

export function NotesList() {
  const { notes, annotations, currentNoteIndex, setCurrentNoteIndex, addBulkAnnotations, filteredNoteIds, setFilteredNoteIds, setNotes } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'done' | 'todo'>('all')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showSmartFilter, setShowSmartFilter] = useState(false)
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

  // Build note ID -> index map for O(1) lookups
  const noteIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    notes.forEach((note, idx) => map.set(note.id, idx))
    return map
  }, [notes])

  // Get unique note types with counts (computed once)
  const { noteTypes, typeCounts } = useMemo(() => {
    const types = new Set<string>()
    const counts = new Map<string, number>()
    for (const note of notes) {
      if (note.meta?.type) {
        types.add(note.meta.type)
        counts.set(note.meta.type, (counts.get(note.meta.type) || 0) + 1)
      }
    }
    return { noteTypes: Array.from(types).sort(), typeCounts: counts }
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
    if (filteredNoteIds) {
      candidates = candidates.filter(n => filteredNoteIds.has(n.id))
    }
    
    // Use index for search if available
    if (debouncedSearch && searchIndex && !filteredNoteIds) {
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
  }, [notes, debouncedSearch, filter, typeFilter, annotationCounts, searchIndex, filteredNoteIds])

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

  // Build filtered note position map for O(1) lookup
  const filteredIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((note, idx) => map.set(note.id, idx))
    return map
  }, [filtered])

  // Jump to page containing current note - O(1) lookup
  const jumpToCurrent = useCallback(() => {
    const currentNote = notes[currentNoteIndex]
    if (!currentNote) return
    const idx = filteredIndexMap.get(currentNote.id)
    if (idx !== undefined) {
      setPage(Math.floor(idx / PAGE_SIZE))
    }
  }, [notes, currentNoteIndex, filteredIndexMap])

  const annotatedCount = useMemo(() => {
    let count = 0
    for (const noteId of annotationCounts.keys()) {
      if (noteIndexMap.has(noteId)) count++
    }
    return count
  }, [annotationCounts, noteIndexMap])

  async function handleSmartFilterApply(ids: Set<string>, matches?: MatchLocation[]) {
    setFilteredNoteIds(ids)
    setPage(0)
    
    // Auto-tag if matches provided - batch to avoid UI freeze
    if (matches && matches.length > 0) {
      const { setImporting } = useStore.getState()
      setImporting(true, `Creating ${matches.length} annotations...`)
      
      // Small delay to let UI update
      await new Promise(r => setTimeout(r, 50))
      
      const bulkAnns = matches.map(m => ({
        noteId: m.noteId,
        text: m.term,
        start: m.start,
        end: m.end,
        questions: [m.questionId]  // Tag with the question that found this match
      }))
      addBulkAnnotations(bulkAnns)
      
      setImporting(true, `Created ${matches.length} annotations`)
      setTimeout(() => setImporting(false), 1000)
    }
  }

  function clearSmartFilter() {
    setFilteredNoteIds(null)
    setPage(0)
  }

  function handleDeleteNonMatching(noteIdsToKeep: Set<string>) {
    const keptNotes = notes.filter(n => noteIdsToKeep.has(n.id))
    setNotes(keptNotes)
    setFilteredNoteIds(null)
    setPage(0)
  }

  return (
    <aside className="w-52 bg-white dark:bg-maple-800 border-r border-maple-200 dark:border-maple-700 flex flex-col">
      <div className="p-2 space-y-2 border-b border-maple-100 dark:border-maple-700">
        {/* Smart Filter button */}
        <button
          onClick={() => setShowSmartFilter(true)}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] rounded border transition-all ${
            filteredNoteIds
              ? 'bg-maple-100 dark:bg-maple-700 border-maple-400 dark:border-maple-500 text-maple-700 dark:text-maple-200 font-medium'
              : 'border-maple-200 dark:border-maple-600 text-maple-500 dark:text-maple-400 hover:bg-maple-50 dark:hover:bg-maple-700'
          }`}
        >
          <Zap size={12} />
          {filteredNoteIds ? `Filtered: ${filteredNoteIds.size}` : 'Smart Filter'}
        </button>

        {/* Active smart filter indicator */}
        {filteredNoteIds && (
          <div className="flex items-center gap-1 bg-maple-100 dark:bg-maple-700 text-maple-600 dark:text-maple-300 rounded px-2 py-1">
            <span className="text-[9px] flex-1">{filteredNoteIds.size} of {notes.length} notes</span>
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
                  <span className="text-maple-400 dark:text-maple-500 ml-1">{typeCounts.get(type) || 0}</span>
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
          const originalIndex = noteIndexMap.get(note.id) ?? 0
          return (
            <NoteItem
              key={note.id}
              note={note}
              index={originalIndex}
              isSelected={originalIndex === currentNoteIndex}
              annotationCount={annotationCounts.get(note.id) || 0}
              hasSuggested={suggestedNotes.has(note.id)}
              onClick={() => setCurrentNoteIndex(originalIndex)}
            />
          )
        })}
        
        {paged.length === 0 && (
          <div className="p-4 text-center text-[10px] text-maple-400 dark:text-maple-500">
            {search || typeFilter || filteredNoteIds ? 'No matches' : 'No notes'}
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
          onDeleteNonMatching={handleDeleteNonMatching}
          onClose={() => setShowSmartFilter(false)}
        />
      )}
    </aside>
  )
}
