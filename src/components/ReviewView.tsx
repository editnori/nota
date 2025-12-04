import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { loadQuestions, getQuestion } from '../lib/questions'
import { X, ExternalLink } from 'lucide-react'

export function ReviewView() {
  const { notes, annotations, removeAnnotation, setMode, setCurrentNoteIndex } = useStore()
  const [selectedQ, setSelectedQ] = useState<string | null>(null)
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

  const filteredAnnotations = selectedQ 
    ? annotations.filter(a => a.questions.includes(selectedQ))
    : annotations

  function goToNote(noteId: string) {
    const idx = notes.findIndex(n => n.id === noteId)
    if (idx >= 0) {
      setCurrentNoteIndex(idx)
      setMode('annotate')
    }
  }

  return (
    <div className="flex-1 flex">
      <aside className="w-52 bg-white border-r border-maple-200 flex flex-col">
        <div className="p-3 border-b border-maple-100">
          <div className="text-[10px] uppercase tracking-wide text-maple-500">
            Filter by Question
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => setSelectedQ(null)}
            className={`w-full text-left px-3 py-2.5 text-xs flex items-center justify-between ${
              selectedQ === null ? 'bg-maple-100 font-medium' : 'hover:bg-maple-50'
            }`}
          >
            <span>All annotations</span>
            <span className="text-maple-400">{annotations.length}</span>
          </button>
          
          <div className="h-px bg-maple-100 my-1" />
          
          {questions.map(q => {
            const count = byQuestion.get(q.id)?.length || 0
            const isSelected = selectedQ === q.id
            return (
              <button
                key={q.id}
                onClick={() => setSelectedQ(q.id)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                  isSelected ? 'bg-maple-50' : 'hover:bg-maple-50'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                  style={{ backgroundColor: q.color }}
                >
                  {q.hotkey}
                </span>
                <span className={`text-xs flex-1 ${isSelected ? 'font-medium' : ''}`}>
                  {q.name}
                </span>
                <span className={`text-[10px] ${count > 0 ? 'text-maple-600' : 'text-maple-300'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        <div className="p-3 border-t border-maple-100">
          <div className="text-[10px] text-maple-400 text-center">
            {annotations.length} total across {new Set(annotations.map(a => a.noteId)).size} notes
          </div>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-4 bg-maple-50">
        {filteredAnnotations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-maple-400 mb-1">No annotations {selectedQ ? `for ${getQuestion(selectedQ)?.name}` : ''}</p>
              <p className="text-xs text-maple-300">Switch to Annotate mode to start tagging</p>
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
                  <div className="text-xs text-maple-500">{getQuestion(selectedQ)?.hint}</div>
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

              return (
                <div key={ann.id} className="bg-white border border-maple-200 rounded-xl p-4">
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
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => goToNote(ann.noteId)}
                        className="p-1.5 text-maple-400 hover:text-maple-600 hover:bg-maple-50 rounded-lg"
                        title="View in note"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        onClick={() => removeAnnotation(ann.id)}
                        className="p-1.5 text-maple-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-xs text-maple-500 mb-2 flex items-center gap-2">
                    <span className="font-medium">{ann.noteId}</span>
                    {note?.meta?.type && (
                      <span className="text-maple-400 bg-maple-100 px-2 py-0.5 rounded-full text-[10px]">
                        {note.meta.type}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-maple-700 leading-relaxed font-mono">
                    <span className="text-maple-400">...{contextBefore}</span>
                    <mark 
                      className="px-1 py-0.5 rounded font-medium"
                      style={{ 
                        backgroundColor: `${getQuestion(ann.questions[0])?.color}20`,
                        color: getQuestion(ann.questions[0])?.color 
                      }}
                    >
                      {ann.text}
                    </mark>
                    <span className="text-maple-400">{contextAfter}...</span>
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
