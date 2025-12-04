import { useState, useMemo } from 'react'
import { useStore } from '../hooks/useStore'
import { loadQuestions, getQuestion } from '../lib/questions'
import { X, ExternalLink, Search, Wand2, BarChart3 } from 'lucide-react'

export function ReviewView() {
  const { notes, annotations, removeAnnotation, setMode, setCurrentNoteIndex, addBulkAnnotations } = useStore()
  const [selectedQ, setSelectedQ] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [showBulkTag, setShowBulkTag] = useState(false)
  const [bulkSearch, setBulkSearch] = useState('')
  const [showStats, setShowStats] = useState(false)
  const questions = loadQuestions()

  const noteMap = new Map(notes.map(n => [n.id, n]))

  const byQuestion = new Map<string, typeof annotations>()
  questions.forEach(q => byQuestion.set(q.id, []))
  
  annotations.forEach(ann => {
    ann.questions.forEach(qid => {
      const list = byQuestion.get(qid)
      if (list) list.push(ann)
    })
  })

  // Filter annotations by selected question and search text
  const filteredAnnotations = useMemo(() => {
    let filtered = annotations
    
    if (selectedQ) {
      filtered = filtered.filter(a => a.questions.includes(selectedQ))
    }
    
    if (searchText.trim()) {
      const lower = searchText.toLowerCase()
      filtered = filtered.filter(a => a.text.toLowerCase().includes(lower))
    }
    
    return filtered
  }, [annotations, selectedQ, searchText])

  // Find matches for bulk tagging
  const bulkMatches = useMemo(() => {
    if (!bulkSearch.trim()) return []
    
    const lower = bulkSearch.toLowerCase()
    const matches: { noteId: string, text: string, start: number, end: number }[] = []
    
    notes.forEach(note => {
      let idx = 0
      while (idx < note.text.length) {
        const foundIdx = note.text.toLowerCase().indexOf(lower, idx)
        if (foundIdx === -1) break
        
        // Check if this exact span is already annotated
        const alreadyTagged = annotations.some(a => 
          a.noteId === note.id && a.start === foundIdx && a.end === foundIdx + bulkSearch.length
        )
        
        if (!alreadyTagged) {
          matches.push({
            noteId: note.id,
            text: note.text.slice(foundIdx, foundIdx + bulkSearch.length),
            start: foundIdx,
            end: foundIdx + bulkSearch.length
          })
        }
        
        idx = foundIdx + 1
      }
    })
    
    return matches
  }, [bulkSearch, notes, annotations])

  function goToNote(noteId: string) {
    const idx = notes.findIndex(n => n.id === noteId)
    if (idx >= 0) {
      setCurrentNoteIndex(idx)
      setMode('annotate')
    }
  }

  function handleBulkTag(questionId: string) {
    if (bulkMatches.length === 0) return
    
    const confirmed = confirm(`Tag ${bulkMatches.length} matches with "${getQuestion(questionId)?.name}"?\n\nThese will be marked as "suggested" and can be removed separately.`)
    if (!confirmed) return
    
    addBulkAnnotations(bulkMatches.map(m => ({
      noteId: m.noteId,
      start: m.start,
      end: m.end,
      text: m.text,
      questions: [questionId]
    })))
    
    setBulkSearch('')
    setShowBulkTag(false)
  }

  function formatTimeAgo(timestamp: number) {
    const diff = Date.now() - timestamp
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  // Stats
  const annotatedNotes = new Set(annotations.map(a => a.noteId)).size
  const manualCount = annotations.filter(a => a.source !== 'suggested').length
  const suggestedCount = annotations.filter(a => a.source === 'suggested').length

  return (
    <div className="flex-1 flex">
      <aside className="w-52 bg-white dark:bg-maple-800 border-r border-maple-200 dark:border-maple-700 flex flex-col">
        <div className="p-3 border-b border-maple-100 dark:border-maple-700">
          <div className="text-[10px] uppercase tracking-wide text-maple-500 dark:text-maple-400 mb-2">
            Filter by Question
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-maple-400" />
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search text..."
              className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-maple-50 dark:bg-maple-700 border border-maple-200 dark:border-maple-600 rounded focus:outline-none focus:border-maple-400 dark:text-maple-200"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => setSelectedQ(null)}
            className={`w-full text-left px-3 py-2.5 text-xs flex items-center justify-between dark:text-maple-200 ${
              selectedQ === null ? 'bg-maple-100 dark:bg-maple-700 font-medium' : 'hover:bg-maple-50 dark:hover:bg-maple-700'
            }`}
          >
            <span>All annotations</span>
            <span className="text-maple-400">{annotations.length}</span>
          </button>
          
          <div className="h-px bg-maple-100 dark:bg-maple-700 my-1" />
          
          {questions.map(q => {
            const count = byQuestion.get(q.id)?.length || 0
            const isSelected = selectedQ === q.id
            return (
              <button
                key={q.id}
                onClick={() => setSelectedQ(q.id)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                  isSelected ? 'bg-maple-50 dark:bg-maple-700' : 'hover:bg-maple-50 dark:hover:bg-maple-700'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                  style={{ backgroundColor: q.color }}
                >
                  {q.hotkey}
                </span>
                <span className={`text-xs flex-1 dark:text-maple-200 ${isSelected ? 'font-medium' : ''}`}>
                  {q.name}
                </span>
                <span className={`text-[10px] ${count > 0 ? 'text-maple-600 dark:text-maple-300' : 'text-maple-300 dark:text-maple-600'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        
        <div className="p-2 border-t border-maple-100 dark:border-maple-700 space-y-1">
          <button
            onClick={() => setShowBulkTag(!showBulkTag)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-[10px] rounded ${showBulkTag ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'text-maple-500 dark:text-maple-400 hover:bg-maple-50 dark:hover:bg-maple-700'}`}
          >
            <Wand2 size={12} />
            Search & Tag
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-[10px] rounded ${showStats ? 'bg-maple-100 dark:bg-maple-700 text-maple-700 dark:text-maple-200' : 'text-maple-500 dark:text-maple-400 hover:bg-maple-50 dark:hover:bg-maple-700'}`}
          >
            <BarChart3 size={12} />
            Stats
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-4 bg-maple-50 dark:bg-maple-900">
        {/* Bulk Tag Panel */}
        {showBulkTag && (
          <div className="max-w-3xl mx-auto mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 size={16} className="text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Search & Tag</span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
              Find text across all notes and tag matches. Results are marked as "suggested" for easy review.
            </p>
            <input
              value={bulkSearch}
              onChange={e => setBulkSearch(e.target.value)}
              placeholder="Enter text to find..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-maple-800 border border-amber-200 dark:border-amber-600 rounded-lg focus:outline-none focus:border-amber-400 dark:text-maple-200 mb-3"
            />
            {bulkMatches.length > 0 && (
              <>
                <div className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                  Found {bulkMatches.length} new matches across {new Set(bulkMatches.map(m => m.noteId)).size} notes
                </div>
                <div className="flex flex-wrap gap-1">
                  {questions.map(q => (
                    <button
                      key={q.id}
                      onClick={() => handleBulkTag(q.id)}
                      className="text-[10px] px-2.5 py-1 rounded text-white hover:opacity-80"
                      style={{ backgroundColor: q.color }}
                    >
                      Tag as {q.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            {bulkSearch && bulkMatches.length === 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-500">
                No new matches found (may already be tagged)
              </div>
            )}
          </div>
        )}

        {/* Stats Panel */}
        {showStats && (
          <div className="max-w-3xl mx-auto mb-4 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-maple-600 dark:text-maple-300" />
              <span className="text-sm font-medium text-maple-800 dark:text-maple-200">Statistics</span>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-maple-800 dark:text-maple-200">{notes.length}</div>
                <div className="text-[10px] text-maple-500 dark:text-maple-400">Notes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-maple-800 dark:text-maple-200">{annotatedNotes}</div>
                <div className="text-[10px] text-maple-500 dark:text-maple-400">Annotated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-maple-800 dark:text-maple-200">{manualCount}</div>
                <div className="text-[10px] text-maple-500 dark:text-maple-400">Manual</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{suggestedCount}</div>
                <div className="text-[10px] text-maple-500 dark:text-maple-400">Suggested</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {questions.map(q => {
                const count = byQuestion.get(q.id)?.length || 0
                const pct = annotations.length > 0 ? (count / annotations.length) * 100 : 0
                return (
                  <div key={q.id} className="flex items-center gap-2">
                    <span className="w-16 text-[10px] text-maple-600 dark:text-maple-300 truncate">{q.name}</span>
                    <div className="flex-1 h-2 bg-maple-100 dark:bg-maple-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: q.color }}
                      />
                    </div>
                    <span className="text-[10px] text-maple-500 dark:text-maple-400 w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {filteredAnnotations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-maple-400 dark:text-maple-500 mb-1">
                No annotations {selectedQ ? `for ${getQuestion(selectedQ)?.name}` : ''} {searchText ? `matching "${searchText}"` : ''}
              </p>
              <p className="text-xs text-maple-300 dark:text-maple-600">Switch to Annotate mode to start tagging</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {selectedQ && (
              <div 
                className="flex items-center gap-2 p-3 rounded-lg mb-4"
                style={{ backgroundColor: `${getQuestion(selectedQ)?.color}15` }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                  style={{ backgroundColor: getQuestion(selectedQ)?.color }}
                >
                  {getQuestion(selectedQ)?.hotkey}
                </span>
                <div>
                  <div className="text-sm font-medium" style={{ color: getQuestion(selectedQ)?.color }}>
                    {getQuestion(selectedQ)?.name}
                  </div>
                  <div className="text-xs text-maple-500 dark:text-maple-400">{getQuestion(selectedQ)?.hint}</div>
                </div>
                <div className="ml-auto text-sm font-medium" style={{ color: getQuestion(selectedQ)?.color }}>
                  {filteredAnnotations.length} annotations
                </div>
              </div>
            )}
            
            {filteredAnnotations.map(ann => {
              const note = noteMap.get(ann.noteId)
              const contextBefore = note?.text.slice(Math.max(0, ann.start - 50), ann.start) || ''
              const contextAfter = note?.text.slice(ann.end, ann.end + 50) || ''
              const isSuggested = ann.source === 'suggested'

              return (
                <div 
                  key={ann.id} 
                  className={`bg-white dark:bg-maple-800 border rounded-xl p-4 ${isSuggested ? 'border-amber-200 dark:border-amber-700' : 'border-maple-200 dark:border-maple-700'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ann.questions.map(qid => {
                        const q = getQuestion(qid)
                        return (
                          <span
                            key={qid}
                            className="text-[10px] px-2.5 py-1 rounded-full text-white font-medium"
                            style={{ backgroundColor: q?.color || '#888' }}
                          >
                            {q?.name || qid}
                          </span>
                        )
                      })}
                      {isSuggested && (
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 font-medium">
                          suggested
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span 
                        className="text-[9px] text-maple-400 dark:text-maple-500 mr-2"
                        title={new Date(ann.createdAt).toLocaleString()}
                      >
                        {formatTimeAgo(ann.createdAt)}
                      </span>
                      <button
                        onClick={() => goToNote(ann.noteId)}
                        className="p-1.5 text-maple-400 dark:text-maple-500 hover:text-maple-600 dark:hover:text-maple-300 hover:bg-maple-50 dark:hover:bg-maple-700 rounded-lg"
                        title="View in note"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        onClick={() => removeAnnotation(ann.id)}
                        className="p-1.5 text-maple-400 dark:text-maple-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-xs text-maple-500 dark:text-maple-400 mb-2 flex items-center gap-2">
                    <span className="font-medium">{ann.noteId}</span>
                    {note?.meta?.type && (
                      <span className="text-maple-400 dark:text-maple-500 bg-maple-100 dark:bg-maple-700 px-2 py-0.5 rounded-full text-[10px]">
                        {note.meta.type}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-maple-700 dark:text-maple-300 leading-relaxed font-mono">
                    <span className="text-maple-400 dark:text-maple-500">...{contextBefore}</span>
                    <mark 
                      className="px-1 py-0.5 rounded font-medium"
                      style={{ 
                        backgroundColor: `${getQuestion(ann.questions[0])?.color}20`,
                        color: getQuestion(ann.questions[0])?.color 
                      }}
                    >
                      {ann.text}
                    </mark>
                    <span className="text-maple-400 dark:text-maple-500">{contextAfter}...</span>
                  </div>

                  {ann.comment && (
                    <div className="mt-2 text-[11px] text-maple-500 dark:text-maple-400 italic bg-maple-50 dark:bg-maple-700 p-2 rounded">
                      {ann.comment}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
