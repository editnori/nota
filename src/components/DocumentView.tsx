import { useCallback, useRef } from 'react'
import { useStore } from '../hooks/useStore'
import { getQuestion } from '../lib/questions'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  onCreateAnnotation: (text: string, start: number, end: number) => void
}

export function DocumentView({ onCreateAnnotation }: Props) {
  const { notes, annotations, currentNoteIndex, setCurrentNoteIndex } = useStore()
  const docRef = useRef<HTMLDivElement>(null)

  const note = notes[currentNoteIndex]
  const noteAnnotations = note ? annotations.filter(a => a.noteId === note.id) : []

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

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-maple-400 mb-2">No notes loaded</p>
          <p className="text-xs text-maple-300">Import some notes to begin annotating</p>
        </div>
      </div>
    )
  }

  const segments = buildSegments(note.text, noteAnnotations)

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="h-10 bg-white border-b border-maple-200 flex items-center px-4 gap-3">
        <div className="flex items-center bg-maple-100 rounded-full p-0.5">
          <button
            onClick={() => setCurrentNoteIndex(Math.max(0, currentNoteIndex - 1))}
            disabled={currentNoteIndex === 0}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-3 text-[11px] text-maple-600 font-medium tabular-nums">
            {currentNoteIndex + 1} / {notes.length}
          </span>
          <button
            onClick={() => setCurrentNoteIndex(Math.min(notes.length - 1, currentNoteIndex + 1))}
            disabled={currentNoteIndex === notes.length - 1}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        
        <span className="text-[11px] text-maple-600 font-medium">{note.id}</span>
        
        {note.meta?.type && (
          <span 
            className="text-[10px] text-maple-500 bg-maple-100 px-2.5 py-1 rounded-full"
          >
            {note.meta.type}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-maple-50">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-maple-200 rounded-xl shadow-sm p-6">
            <div
              id="doc-content"
              ref={docRef}
              className="text-[13px] leading-[1.8] text-maple-700 whitespace-pre-wrap font-mono selection:bg-amber-200"
              onMouseUp={handleTextSelect}
            >
              {segments.map((seg, i) => {
                if (seg.type === 'plain') {
                  return <span key={i}>{seg.text}</span>
                }
                
                const q = getQuestion(seg.questions[0])
                const color = q?.color || '#888'
                
                return (
                  <mark
                    key={i}
                    className="rounded px-0.5 py-0.5"
                    style={{
                      backgroundColor: `${color}25`,
                      borderBottom: `2px solid ${color}`,
                      color: 'inherit'
                    }}
                    title={seg.questions.map(qid => getQuestion(qid)?.name || qid).join(', ')}
                  >
                    {seg.text}
                  </mark>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Segment {
  type: 'plain' | 'highlight'
  text: string
  questions: string[]
}

function buildSegments(text: string, annotations: { start: number; end: number; questions: string[] }[]): Segment[] {
  if (annotations.length === 0) {
    return [{ type: 'plain', text, questions: [] }]
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
      segments.push({ type: 'plain', text: segText, questions: [] })
    } else {
      const questions = [...new Set(covering.flatMap(a => a.questions))]
      segments.push({ type: 'highlight', text: segText, questions })
    }
  }

  return segments
}
