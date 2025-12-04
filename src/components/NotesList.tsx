import { useState, useMemo } from 'react'
import { useStore } from '../hooks/useStore'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'

const PAGE_SIZE = 50

export function NotesList() {
  const { notes, annotations, currentNoteIndex, setCurrentNoteIndex } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'done' | 'todo'>('all')
  const [page, setPage] = useState(0)

  const annotationCounts = useMemo(() => {
    const counts = new Map<string, number>()
    annotations.forEach(a => {
      counts.set(a.noteId, (counts.get(a.noteId) || 0) + 1)
    })
    return counts
  }, [annotations])

  const suggestedNotes = useMemo(() => {
    const set = new Set<string>()
    annotations.filter(a => a.source === 'suggested').forEach(a => set.add(a.noteId))
    return set
  }, [annotations])

  const filtered = useMemo(() => {
    return notes.filter(note => {
      if (search) {
        const lower = search.toLowerCase()
        if (!note.id.toLowerCase().includes(lower) && !note.text.toLowerCase().includes(lower)) {
          return false
        }
      }
      const count = annotationCounts.get(note.id) || 0
      if (filter === 'done' && count === 0) return false
      if (filter === 'todo' && count > 0) return false
      return true
    })
  }, [notes, search, filter, annotationCounts])

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  
  // Keep page in bounds when filter changes
  useMemo(() => {
    if (page >= totalPages && totalPages > 0) {
      setPage(totalPages - 1)
    }
  }, [totalPages, page])

  // Jump to page containing current note
  function jumpToCurrent() {
    const currentNote = notes[currentNoteIndex]
    if (!currentNote) return
    const idx = filtered.findIndex(n => n.id === currentNote.id)
    if (idx >= 0) {
      setPage(Math.floor(idx / PAGE_SIZE))
    }
  }

  const annotatedCount = notes.filter(n => annotationCounts.get(n.id)).length

  return (
    <aside className="w-52 bg-white dark:bg-maple-800 border-r border-maple-200 dark:border-maple-700 flex flex-col">
      <div className="p-2 space-y-2 border-b border-maple-100 dark:border-maple-700">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-maple-400 dark:text-maple-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search notes..."
            className="w-full pl-7 pr-2 py-1 text-[11px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded focus:outline-none focus:border-maple-400 dark:text-maple-200"
          />
        </div>
        <div className="flex text-[9px] border border-maple-200 dark:border-maple-600 rounded overflow-hidden">
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
                  <span className={`text-[8px] px-1 py-0.5 rounded-full font-medium ${hasSuggested ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'}`}>
                    {count}
                  </span>
                )}
              </div>
              <div className="text-[9px] text-maple-400 dark:text-maple-500 truncate leading-tight">
                {note.text.slice(0, 50)}...
              </div>
            </button>
          )
        })}
        
        {paged.length === 0 && (
          <div className="p-4 text-center text-[10px] text-maple-400 dark:text-maple-500">
            {search ? 'No matches' : 'No notes'}
          </div>
        )}
      </div>

      <div className="p-1.5 border-t border-maple-100 dark:border-maple-700 text-[9px] text-maple-400 dark:text-maple-500 text-center">
        {annotatedCount}/{notes.length} done
      </div>
    </aside>
  )
}
