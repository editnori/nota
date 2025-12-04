import { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import { useStore } from '../hooks/useStore'
import { getQuestion, loadQuestions } from '../lib/questions'
import { ChevronLeft, ChevronRight, SkipForward, Minus, Plus, Check } from 'lucide-react'

interface Props {
  onCreateAnnotation: (text: string, start: number, end: number) => void
}

interface SpanEditor {
  annotationId: string
  originalStart: number
  originalEnd: number
  currentStart: number
  currentEnd: number
  position: { x: number, y: number }
}

interface OverlapPrompt {
  newStart: number
  newEnd: number
  newText: string
  overlappingId: string
  overlappingText: string
  position: { x: number, y: number }
}

export function DocumentView({ onCreateAnnotation }: Props) {
  const { notes, annotations, currentNoteIndex, setCurrentNoteIndex, updateAnnotation, fontSize, setFontSize, highlightedAnnotation } = useStore()
  const docRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activeSpan, setActiveSpan] = useState<{ annotationIds: string[] } | null>(null)
  const [glowingMarkId, setGlowingMarkId] = useState<string | null>(null)
  const [spanEditor, setSpanEditor] = useState<SpanEditor | null>(null)
  const [overlapPrompt, setOverlapPrompt] = useState<OverlapPrompt | null>(null)
  
  // Use ref for popup position so it doesn't shift when annotations update
  const popupPositionRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 })

  const note = notes[currentNoteIndex]
  
  // Memoize for performance with large datasets
  const noteAnnotations = useMemo(() => {
    if (!note) return []
    return annotations.filter(a => a.noteId === note.id)
  }, [note, annotations])
  
  // Find notes with annotations for navigation
  const { nextUnannotatedIndex, hasUnannotated } = useMemo(() => {
    const annotatedNoteIds = new Set<string>()
    for (const a of annotations) {
      annotatedNoteIds.add(a.noteId)
    }
    
    let nextIdx = -1
    for (let i = currentNoteIndex + 1; i < notes.length; i++) {
      if (!annotatedNoteIds.has(notes[i].id)) {
        nextIdx = i
        break
      }
    }
    
    const hasUnannotated = notes.some(n => !annotatedNoteIds.has(n.id))
    
    return { nextUnannotatedIndex: nextIdx, hasUnannotated }
  }, [annotations, notes, currentNoteIndex])

  // Scroll to highlighted annotation when it changes - with smooth animation
  useEffect(() => {
    if (highlightedAnnotation && docRef.current && scrollContainerRef.current) {
      // Small delay to allow DOM to render
      requestAnimationFrame(() => {
        const mark = docRef.current?.querySelector(`mark[data-ann-ids*="${highlightedAnnotation}"]`)
        if (mark && scrollContainerRef.current) {
          // Calculate position for smooth centered scroll
          const container = scrollContainerRef.current
          const markRect = mark.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          
          // Calculate target scroll position to center the element
          const targetScroll = container.scrollTop + markRect.top - containerRect.top - containerRect.height / 2 + markRect.height / 2
          
          // Smooth scroll
          container.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth'
          })
          
          // After scroll completes, trigger glow (continues until user hovers)
          setTimeout(() => {
            setGlowingMarkId(highlightedAnnotation)
          }, 300)
        }
      })
    }
  }, [highlightedAnnotation])

  // Get selection coordinates from document
  const getSelectionCoords = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return null

    const text = sel.toString().trim()
    if (!text) return null

    const container = docRef.current
    if (!container) return null

    const range = sel.getRangeAt(0)
    const preRange = document.createRange()
    preRange.selectNodeContents(container)
    preRange.setEnd(range.startContainer, range.startOffset)
    
    const start = preRange.toString().length
    const end = start + text.length

    return { text, start, end }
  }, [])

  const handleTextSelect = useCallback(() => {
    const coords = getSelectionCoords()
    if (!coords) return

    const { text, start, end } = coords

    // If span editor is open, update its boundaries instead of creating new annotation
    if (spanEditor) {
      setSpanEditor({ ...spanEditor, currentStart: start, currentEnd: end })
      window.getSelection()?.removeAllRanges()
      return
    }

    // Check for overlaps with existing annotations
    const overlapping = noteAnnotations.filter(a => 
      (start < a.end && end > a.start) // Any overlap
    )

    if (overlapping.length > 0) {
      // Find the one with most overlap
      const primary = overlapping[0]
      
      // If selection is entirely within existing annotation, just open its popup
      if (start >= primary.start && end <= primary.end) {
        window.getSelection()?.removeAllRanges()
        return
      }

      // Show overlap prompt with three options
      const sel = window.getSelection()
      const range = sel?.getRangeAt(0)
      const rect = range?.getBoundingClientRect()
      
      setOverlapPrompt({
        newStart: start,
        newEnd: end,
        newText: text,
        overlappingId: primary.id,
        overlappingText: primary.text,
        position: { x: rect?.left || 100, y: (rect?.bottom || 100) + 4 }
      })
      window.getSelection()?.removeAllRanges()
      return
    }

    onCreateAnnotation(text, start, end)
    window.getSelection()?.removeAllRanges()
  }, [getSelectionCoords, onCreateAnnotation, spanEditor, noteAnnotations])

  function handleOverlapExtend() {
    if (!overlapPrompt || !note) return
    
    const existing = annotations.find(a => a.id === overlapPrompt.overlappingId)
    if (!existing) return
    
    // Extend to cover both
    const newStart = Math.min(overlapPrompt.newStart, existing.start)
    const newEnd = Math.max(overlapPrompt.newEnd, existing.end)
    const newText = note.text.slice(newStart, newEnd)
    
    updateAnnotation(overlapPrompt.overlappingId, {
      start: newStart,
      end: newEnd,
      text: newText
    })
    setOverlapPrompt(null)
  }

  function handleOverlapCreate() {
    if (!overlapPrompt) return
    onCreateAnnotation(overlapPrompt.newText, overlapPrompt.newStart, overlapPrompt.newEnd)
    setOverlapPrompt(null)
  }

  function handleOverlapCancel() {
    setOverlapPrompt(null)
  }

  function handleSpanClick(e: React.MouseEvent, annotationIds: string[]) {
    e.stopPropagation()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    // Store position in ref so it doesn't change when annotations update
    popupPositionRef.current = { x: rect.left, y: rect.bottom + 4 }
    setActiveSpan({ annotationIds })
  }

  function handleSpanDoubleClick(e: React.MouseEvent, annotationIds: string[]) {
    e.stopPropagation()
    e.preventDefault()
    
    // Edit the first annotation's span
    const annId = annotationIds[0]
    const ann = annotations.find(a => a.id === annId)
    if (!ann) return
    
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setSpanEditor({
      annotationId: annId,
      originalStart: ann.start,
      originalEnd: ann.end,
      currentStart: ann.start,
      currentEnd: ann.end,
      position: { x: rect.left, y: rect.bottom + 4 }
    })
    setActiveSpan(null)
  }

  function handleToggleQuestion(questionId: string) {
    if (!activeSpan) return
    
    activeSpan.annotationIds.forEach(annId => {
      const ann = annotations.find(a => a.id === annId)
      if (!ann) return
      
      if (ann.questions.includes(questionId)) {
        // Remove question (but keep at least one)
        if (ann.questions.length > 1) {
          updateAnnotation(annId, { questions: ann.questions.filter(q => q !== questionId) })
        }
      } else {
        // Add question
        updateAnnotation(annId, { questions: [...ann.questions, questionId] })
      }
    })
  }

  function handleSpanEditorSave() {
    if (!spanEditor || !note) return
    
    const { annotationId, currentStart, currentEnd } = spanEditor
    const newText = note.text.slice(currentStart, currentEnd)
    
    updateAnnotation(annotationId, {
      start: currentStart,
      end: currentEnd,
      text: newText
    })
    setSpanEditor(null)
  }

  function handleSpanEditorCancel() {
    setSpanEditor(null)
  }

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-maple-400 dark:text-maple-500 mb-2">No notes loaded</p>
          <p className="text-xs text-maple-300 dark:text-maple-600">Import or drag-drop notes to begin</p>
        </div>
      </div>
    )
  }

  const segments = buildSegments(note.text, noteAnnotations, annotations)
  const questions = loadQuestions()

  return (
    <div className="flex-1 flex flex-col min-w-0" onClick={() => { setActiveSpan(null); setSpanEditor(null); setOverlapPrompt(null) }}>
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
            title="Smaller"
          >
            <Minus size={10} />
          </button>
          <span className="text-[9px] text-maple-500 dark:text-maple-400 w-4 text-center">{fontSize}</span>
          <button
            onClick={() => setFontSize(Math.min(20, fontSize + 1))}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600"
            title="Larger"
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
            <span>Next</span>
          </button>
        )}
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 bg-maple-50 dark:bg-maple-900">
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
                const isSuggested = seg.isSuggested
                const isGlowing = seg.annotationIds.some(id => id === glowingMarkId)
                
                // Create gradient border for multiple questions
                const borderStyle = colors.length > 1
                  ? `linear-gradient(90deg, ${colors.join(', ')})`
                  : primaryColor
                
                return (
                  <span key={i} className="relative inline">
                    <mark
                      data-ann-ids={seg.annotationIds.join(',')}
                      className={`rounded px-0.5 py-0.5 cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-maple-400 transition-all ${
                        isGlowing ? 'animate-glow' : ''
                      }`}
                      style={{
                        backgroundColor: `${primaryColor}${isSuggested ? '15' : '20'}`,
                        borderBottom: colors.length > 1 ? 'none' : `2px ${isSuggested ? 'dashed' : 'solid'} ${primaryColor}`,
                        color: 'inherit',
                        opacity: isSuggested ? 0.8 : 1
                      }}
                      title={`${seg.questions.map(qid => getQuestion(qid)?.name || qid).join(' + ')}${isSuggested ? ' (auto)' : ''}\nClick: edit questions | Double-click: edit span`}
                      onClick={(e) => handleSpanClick(e, seg.annotationIds)}
                      onDoubleClick={(e) => handleSpanDoubleClick(e, seg.annotationIds)}
                      onMouseEnter={() => isGlowing && setGlowingMarkId(null)}
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

      {/* Question picker popup - toggle questions on/off */}
      {activeSpan && (
        <div
          className="fixed z-50 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded-lg shadow-lg p-2 max-w-xs"
          style={{ left: popupPositionRef.current.x, top: popupPositionRef.current.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-[10px] text-maple-500 dark:text-maple-400 mb-2">Toggle questions (click to add/remove):</div>
          <div className="flex flex-wrap gap-1">
            {questions.map(q => {
              // Check if any annotation has this question
              const hasQuestion = activeSpan.annotationIds.some(annId => {
                const ann = annotations.find(a => a.id === annId)
                return ann?.questions.includes(q.id)
              })
              
              // Check if this is the only question (can't remove last one)
              const isOnlyQuestion = hasQuestion && activeSpan.annotationIds.every(annId => {
                const ann = annotations.find(a => a.id === annId)
                return ann?.questions.length === 1 && ann.questions[0] === q.id
              })
              
              return (
                <button
                  key={q.id}
                  onClick={() => handleToggleQuestion(q.id)}
                  disabled={isOnlyQuestion}
                  className={`text-[9px] px-2 py-1 rounded transition-all flex items-center gap-1 ${
                    hasQuestion 
                      ? 'text-white ring-2 ring-offset-1' 
                      : 'text-white opacity-40 hover:opacity-70'
                  } ${isOnlyQuestion ? 'cursor-not-allowed' : 'hover:scale-105'}`}
                  style={{ 
                    backgroundColor: q.color,
                    // @ts-expect-error CSS variable
                    '--tw-ring-color': q.color
                  }}
                  title={isOnlyQuestion ? 'Cannot remove last question' : hasQuestion ? `Remove "${q.name}"` : `Add "${q.name}"`}
                >
                  {hasQuestion && <Check size={10} />}
                  {q.hotkey}. {q.name}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-maple-100 dark:border-maple-700">
            <span className="text-[9px] text-maple-400 dark:text-maple-500">
              Double-click span to edit bounds
            </span>
            <button
              onClick={() => setActiveSpan(null)}
              className="text-[10px] text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Overlap prompt - three options */}
      {overlapPrompt && (
        <div
          className="fixed z-50 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded-lg shadow-lg p-3 w-72"
          style={{ left: overlapPrompt.position.x, top: overlapPrompt.position.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-[11px] text-maple-700 dark:text-maple-200 mb-3">
            Selection overlaps with:
            <span className="block mt-1 text-[10px] text-maple-500 dark:text-maple-400 italic truncate">
              "{overlapPrompt.overlappingText.slice(0, 40)}{overlapPrompt.overlappingText.length > 40 ? '...' : ''}"
            </span>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <button
              onClick={handleOverlapExtend}
              className="w-full text-[10px] px-3 py-1.5 bg-maple-800 dark:bg-maple-600 text-white rounded hover:bg-maple-700 dark:hover:bg-maple-500 text-left"
            >
              <span className="font-medium">Extend</span>
              <span className="text-maple-300 dark:text-maple-400 ml-1">- grow existing to include selection</span>
            </button>
            <button
              onClick={handleOverlapCreate}
              className="w-full text-[10px] px-3 py-1.5 bg-maple-100 dark:bg-maple-700 text-maple-700 dark:text-maple-200 rounded hover:bg-maple-200 dark:hover:bg-maple-600 text-left"
            >
              <span className="font-medium">Overlap</span>
              <span className="text-maple-500 dark:text-maple-400 ml-1">- create overlapping span</span>
            </button>
            <button
              onClick={handleOverlapCancel}
              className="w-full text-[10px] px-3 py-1.5 text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200 text-left"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Span editor popup - adjust start/end */}
      {spanEditor && note && (
        <div
          className="fixed z-50 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded-lg shadow-lg p-3 w-80"
          style={{ left: spanEditor.position.x, top: spanEditor.position.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-[10px] text-maple-500 dark:text-maple-400 mb-2">
            Edit span: <span className="text-maple-700 dark:text-maple-300">select new text in document</span> or fine-tune below
          </div>
          
          {/* Preview */}
          <div className="text-[11px] bg-maple-50 dark:bg-maple-700 rounded p-2 mb-3 font-mono break-words max-h-20 overflow-y-auto">
            <span className="text-maple-400">...</span>
            <span className="bg-amber-200 dark:bg-amber-700 px-0.5 rounded">
              {note.text.slice(spanEditor.currentStart, spanEditor.currentEnd)}
            </span>
            <span className="text-maple-400">...</span>
          </div>
          
          {/* Fine-tune controls */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[9px] text-maple-500 dark:text-maple-400 block mb-1">Start</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSpanEditor({ ...spanEditor, currentStart: Math.max(0, spanEditor.currentStart - 5) })}
                  className="w-6 h-6 flex items-center justify-center bg-maple-100 dark:bg-maple-700 rounded hover:bg-maple-200 dark:hover:bg-maple-600 text-[9px]"
                  title="Move start back 5 chars"
                >
                  -5
                </button>
                <button
                  onClick={() => setSpanEditor({ ...spanEditor, currentStart: Math.max(0, spanEditor.currentStart - 1) })}
                  className="w-5 h-6 flex items-center justify-center bg-maple-100 dark:bg-maple-700 rounded hover:bg-maple-200 dark:hover:bg-maple-600 text-[9px]"
                >
                  -1
                </button>
                <button
                  onClick={() => setSpanEditor({ ...spanEditor, currentStart: Math.min(spanEditor.currentEnd - 1, spanEditor.currentStart + 1) })}
                  className="w-5 h-6 flex items-center justify-center bg-maple-100 dark:bg-maple-700 rounded hover:bg-maple-200 dark:hover:bg-maple-600 text-[9px]"
                >
                  +1
                </button>
                <button
                  onClick={() => setSpanEditor({ ...spanEditor, currentStart: Math.min(spanEditor.currentEnd - 1, spanEditor.currentStart + 5) })}
                  className="w-6 h-6 flex items-center justify-center bg-maple-100 dark:bg-maple-700 rounded hover:bg-maple-200 dark:hover:bg-maple-600 text-[9px]"
                  title="Move start forward 5 chars"
                >
                  +5
                </button>
              </div>
            </div>
            <div>
              <label className="text-[9px] text-maple-500 dark:text-maple-400 block mb-1">End</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSpanEditor({ ...spanEditor, currentEnd: Math.max(spanEditor.currentStart + 1, spanEditor.currentEnd - 5) })}
                  className="w-6 h-6 flex items-center justify-center bg-maple-100 dark:bg-maple-700 rounded hover:bg-maple-200 dark:hover:bg-maple-600 text-[9px]"
                  title="Move end back 5 chars"
                >
                  -5
                </button>
                <button
                  onClick={() => setSpanEditor({ ...spanEditor, currentEnd: Math.max(spanEditor.currentStart + 1, spanEditor.currentEnd - 1) })}
                  className="w-5 h-6 flex items-center justify-center bg-maple-100 dark:bg-maple-700 rounded hover:bg-maple-200 dark:hover:bg-maple-600 text-[9px]"
                >
                  -1
                </button>
                <button
                  onClick={() => setSpanEditor({ ...spanEditor, currentEnd: Math.min(note.text.length, spanEditor.currentEnd + 1) })}
                  className="w-5 h-6 flex items-center justify-center bg-maple-100 dark:bg-maple-700 rounded hover:bg-maple-200 dark:hover:bg-maple-600 text-[9px]"
                >
                  +1
                </button>
                <button
                  onClick={() => setSpanEditor({ ...spanEditor, currentEnd: Math.min(note.text.length, spanEditor.currentEnd + 5) })}
                  className="w-6 h-6 flex items-center justify-center bg-maple-100 dark:bg-maple-700 rounded hover:bg-maple-200 dark:hover:bg-maple-600 text-[9px]"
                  title="Move end forward 5 chars"
                >
                  +5
                </button>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-maple-400 dark:text-maple-500">
              {spanEditor.currentEnd - spanEditor.currentStart} chars
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSpanEditorCancel}
                className="text-[10px] px-2 py-1 text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSpanEditorSave}
                className="text-[10px] px-3 py-1 bg-maple-800 dark:bg-maple-600 text-white rounded hover:bg-maple-700 dark:hover:bg-maple-500 flex items-center gap-1"
              >
                <Check size={10} />
                Save
              </button>
            </div>
          </div>
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
  isSuggested: boolean
}

function buildSegments(
  text: string, 
  noteAnnotations: { id: string; start: number; end: number; questions: string[] }[],
  allAnnotations: { id: string; source?: string }[]
): Segment[] {
  if (noteAnnotations.length === 0) {
    return [{ type: 'plain', text, questions: [], annotationIds: [], isSuggested: false }]
  }

  const points = new Set<number>([0, text.length])
  for (const a of noteAnnotations) {
    points.add(Math.max(0, a.start))
    points.add(Math.min(text.length, a.end))
  }

  const sorted = Array.from(points).sort((a, b) => a - b)
  const segments: Segment[] = []

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]
    const end = sorted[i + 1]
    const segText = text.slice(start, end)

    const covering = noteAnnotations.filter(a => a.start <= start && a.end >= end)
    
    if (covering.length === 0) {
      segments.push({ type: 'plain', text: segText, questions: [], annotationIds: [], isSuggested: false })
    } else {
      const questions = [...new Set(covering.flatMap(a => a.questions))]
      const annotationIds = covering.map(a => a.id)
      
      // Check if any of the covering annotations are suggested
      const isSuggested = covering.some(c => {
        const fullAnn = allAnnotations.find(a => a.id === c.id)
        return fullAnn?.source === 'suggested'
      })
      
      segments.push({ type: 'highlight', text: segText, questions, annotationIds, isSuggested })
    }
  }

  return segments
}
