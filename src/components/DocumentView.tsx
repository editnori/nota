import { useCallback, useRef, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { getQuestion, loadQuestions } from '../lib/questions'
import { ChevronLeft, ChevronRight, SkipForward, Minus, Plus } from 'lucide-react'

interface Props {
  onCreateAnnotation: (text: string, start: number, end: number) => void
}

export function DocumentView({ onCreateAnnotation }: Props) {
  const { notes, annotations, currentNoteIndex, setCurrentNoteIndex, updateAnnotation, fontSize, setFontSize } = useStore()
  const docRef = useRef<HTMLDivElement>(null)
  const [activeSpan, setActiveSpan] = useState<{ annotationIds: string[], position: { x: number, y: number } } | null>(null)

  const note = notes[currentNoteIndex]
  const noteAnnotations = note ? annotations.filter(a => a.noteId === note.id) : []
  
  // Find notes with annotations for stats and navigation
  const annotatedNoteIds = new Set(annotations.map(a => a.noteId))
  const nextUnannotatedIndex = notes.findIndex((n, i) => i > currentNoteIndex && !annotatedNoteIds.has(n.id))
  const hasUnannotated = notes.some(n => !annotatedNoteIds.has(n.id))

  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return

    const text = sel.toString().trim()
    if (!text) return

    const container = docRef.current
    if (!container) return

    const range = sel.getRangeAt(0)
    const preRange = document.createRange()
    preRange.selectNodeContents(container)
    preRange.setEnd(range.startContainer, range.startOffset)
    
    const start = preRange.toString().length
    const end = start + text.length

    onCreateAnnotation(text, start, end)
    sel.removeAllRanges()
  }, [onCreateAnnotation])

  function handleSpanClick(e: React.MouseEvent, annotationIds: string[]) {
    e.stopPropagation()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setActiveSpan({
      annotationIds,
      position: { x: rect.left, y: rect.bottom + 4 }
    })
  }

  function handleAddQuestionToSpan(questionId: string) {
    if (!activeSpan) return
    
    activeSpan.annotationIds.forEach(annId => {
      const ann = annotations.find(a => a.id === annId)
      if (ann && !ann.questions.includes(questionId)) {
        updateAnnotation(annId, { questions: [...ann.questions, questionId] })
      }
    })
    setActiveSpan(null)
  }

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-maple-400 dark:text-maple-500 mb-2">No notes loaded</p>
          <p className="text-xs text-maple-300 dark:text-maple-600">Import some notes to begin annotating</p>
        </div>
      </div>
    )
  }

  const segments = buildSegments(note.text, noteAnnotations)
  const questions = loadQuestions()

  return (
    <div className="flex-1 flex flex-col min-w-0" onClick={() => setActiveSpan(null)}>
      <div className="h-10 bg-white dark:bg-maple-800 border-b border-maple-200 dark:border-maple-700 flex items-center px-3 gap-2">
        <div className="flex items-center bg-maple-100 dark:bg-maple-700 rounded-full shrink-0">
          <button
            onClick={() => setCurrentNoteIndex(Math.max(0, currentNoteIndex - 1))}
            disabled={currentNoteIndex === 0}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600 disabled:opacity-30"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="px-1 text-[10px] text-maple-600 dark:text-maple-300 tabular-nums whitespace-nowrap">
            {currentNoteIndex + 1}/{notes.length}
          </span>
          <button
            onClick={() => setCurrentNoteIndex(Math.min(notes.length - 1, currentNoteIndex + 1))}
            disabled={currentNoteIndex === notes.length - 1}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600 disabled:opacity-30"
          >
            <ChevronRight size={12} />
          </button>
        </div>
        
        <span className="text-[11px] text-maple-600 dark:text-maple-300 truncate">{note.id}</span>
        
        {note.meta?.type && (
          <span className="text-[9px] text-maple-500 dark:text-maple-400 bg-maple-100 dark:bg-maple-700 px-2 py-0.5 rounded-full shrink-0">
            {note.meta.type}
          </span>
        )}
        
        <div className="flex-1" />

        {/* Font size control */}
        <div className="flex items-center gap-1 bg-maple-100 dark:bg-maple-700 rounded-full px-1">
          <button
            onClick={() => setFontSize(Math.max(10, fontSize - 1))}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600"
            title="Decrease font size"
          >
            <Minus size={10} />
          </button>
          <span className="text-[9px] text-maple-500 dark:text-maple-400 w-4 text-center">{fontSize}</span>
          <button
            onClick={() => setFontSize(Math.min(20, fontSize + 1))}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600"
            title="Increase font size"
          >
            <Plus size={10} />
          </button>
        </div>
        
        {hasUnannotated && nextUnannotatedIndex !== -1 && (
          <button
            onClick={() => setCurrentNoteIndex(nextUnannotatedIndex)}
            className="flex items-center gap-1 text-[10px] text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200 hover:bg-maple-100 dark:hover:bg-maple-700 px-2 py-1 rounded"
            title="Jump to next unannotated note"
          >
            <SkipForward size={11} />
            <span>Next todo</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-maple-50 dark:bg-maple-900">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-700 rounded-xl shadow-sm p-6">
            <div
              id="doc-content"
              ref={docRef}
              className="leading-[1.8] text-maple-700 dark:text-maple-200 whitespace-pre-wrap font-mono selection:bg-amber-200 dark:selection:bg-amber-700"
              style={{ fontSize: `${fontSize}px` }}
              onMouseUp={handleTextSelect}
            >
              {segments.map((seg, i) => {
                if (seg.type === 'plain') {
                  return <span key={i}>{seg.text}</span>
                }
                
                const colors = seg.questions.map(qid => getQuestion(qid)?.color || '#888')
                const primaryColor = colors[0]
                const isSuggested = seg.annotationIds.some(aid => {
                  const ann = annotations.find(a => a.id === aid)
                  return ann?.source === 'suggested'
                })
                
                // Create gradient border for multiple questions
                const borderStyle = colors.length > 1
                  ? `linear-gradient(90deg, ${colors.join(', ')})`
                  : primaryColor
                
                return (
                  <span key={i} className="relative inline">
                    <mark
                      className={`rounded px-0.5 py-0.5 cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-maple-400 ${isSuggested ? 'opacity-70' : ''}`}
                      style={{
                        backgroundColor: `${primaryColor}20`,
                        borderBottom: colors.length > 1 ? 'none' : `2px ${isSuggested ? 'dashed' : 'solid'} ${primaryColor}`,
                        color: 'inherit'
                      }}
                      title={`${seg.questions.map(qid => getQuestion(qid)?.name || qid).join(' + ')}${isSuggested ? ' (suggested)' : ''}\n(click to add more)`}
                      onClick={(e) => handleSpanClick(e, seg.annotationIds)}
                    >
                      {seg.text}
                      {colors.length > 1 && (
                        <span 
                          className="absolute bottom-0 left-0 right-0 h-0.5"
                          style={{ background: borderStyle }}
                        />
                      )}
                    </mark>
                    {/* Show question indicators */}
                    {colors.length > 0 && (
                      <span className="inline-flex gap-px ml-0.5 align-middle">
                        {colors.map((color, ci) => (
                          <span
                            key={ci}
                            className={`w-1.5 h-1.5 rounded-full inline-block ${isSuggested ? 'opacity-60' : ''}`}
                            style={{ backgroundColor: color }}
                            title={getQuestion(seg.questions[ci])?.name}
                          />
                        ))}
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Question picker popup for adding to existing span */}
      {activeSpan && (
        <div
          className="fixed z-50 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded-lg shadow-lg p-2 max-w-xs"
          style={{ left: activeSpan.position.x, top: activeSpan.position.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-[10px] text-maple-500 dark:text-maple-400 mb-2">Add another question:</div>
          <div className="flex flex-wrap gap-1">
            {questions.map(q => {
              // Check if all annotations already have this question
              const allHave = activeSpan.annotationIds.every(annId => {
                const ann = annotations.find(a => a.id === annId)
                return ann?.questions.includes(q.id)
              })
              
              if (allHave) return null
              
              return (
                <button
                  key={q.id}
                  onClick={() => handleAddQuestionToSpan(q.id)}
                  className="text-[9px] px-2 py-1 rounded text-white hover:opacity-80"
                  style={{ backgroundColor: q.color }}
                >
                  {q.hotkey}. {q.name}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setActiveSpan(null)}
            className="mt-2 text-[10px] text-maple-400 dark:text-maple-500 hover:text-maple-600 dark:hover:text-maple-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

interface Segment {
  type: 'plain' | 'highlight'
  text: string
  questions: string[]
  annotationIds: string[]
}

function buildSegments(text: string, annotations: { id: string; start: number; end: number; questions: string[] }[]): Segment[] {
  if (annotations.length === 0) {
    return [{ type: 'plain', text, questions: [], annotationIds: [] }]
  }

  const points = new Set<number>([0, text.length])
  annotations.forEach(a => {
    points.add(Math.max(0, a.start))
    points.add(Math.min(text.length, a.end))
  })

  const sorted = Array.from(points).sort((a, b) => a - b)
  const segments: Segment[] = []

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]
    const end = sorted[i + 1]
    const segText = text.slice(start, end)

    const covering = annotations.filter(a => a.start <= start && a.end >= end)
    
    if (covering.length === 0) {
      segments.push({ type: 'plain', text: segText, questions: [], annotationIds: [] })
    } else {
      const questions = [...new Set(covering.flatMap(a => a.questions))]
      const annotationIds = covering.map(a => a.id)
      segments.push({ type: 'highlight', text: segText, questions, annotationIds })
    }
  }

  return segments
}
