import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { Search } from 'lucide-react'

export function NotesList() {
  const { notes, annotations, currentNoteIndex, setCurrentNoteIndex } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'annotated' | 'unannotated'>('all')

  const annotationCounts = new Map<string, number>()
  annotations.forEach(a => {
    annotationCounts.set(a.noteId, (annotationCounts.get(a.noteId) || 0) + 1)
  })

  const filtered = notes.filter(note => {
    if (search && !note.id.toLowerCase().includes(search.toLowerCase()) && !note.text.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    const count = annotationCounts.get(note.id) || 0
    if (filter === 'annotated' && count === 0) return false
    if (filter === 'unannotated' && count > 0) return false
    return true
  })

  const annotatedCount = notes.filter(n => annotationCounts.get(n.id)).length

  return (
    <aside className="w-56 bg-white border-r border-maple-200 flex flex-col">
      <div className="p-3 space-y-2 border-b border-maple-100">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-maple-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-maple-50 border border-maple-200 rounded focus:outline-none focus:border-maple-400"
          />
        </div>
        <div className="flex text-[10px] border border-maple-200 rounded overflow-hidden">
          {(['all', 'annotated', 'unannotated'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1 ${filter === f ? 'bg-maple-800 text-white' : 'text-maple-500 hover:bg-maple-50'}`}
            >
              {f === 'all' ? 'All' : f === 'annotated' ? 'Done' : 'Todo'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((note) => {
          const originalIndex = notes.findIndex(n => n.id === note.id)
          const selected = originalIndex === currentNoteIndex
          const count = annotationCounts.get(note.id) || 0

          return (
            <button
              key={note.id}
              onClick={() => setCurrentNoteIndex(originalIndex)}
              className={`w-full text-left px-3 py-2.5 border-b border-maple-100 ${
                selected ? 'bg-maple-100' : 'hover:bg-maple-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] ${selected ? 'text-maple-600 font-medium' : 'text-maple-400'}`}>
                  {originalIndex + 1}
                </span>
                <span className={`text-[11px] truncate flex-1 ${selected ? 'text-maple-900 font-medium' : 'text-maple-600'}`}>
                  {note.id}
                </span>
                {count > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    {count}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-maple-400 truncate">
                {note.text.slice(0, 60)}...
              </div>
            </button>
          )
        })}
      </div>

      <div className="p-2 border-t border-maple-100 text-[10px] text-maple-400 text-center">
        {annotatedCount} of {notes.length} annotated
      </div>
    </aside>
  )
}
