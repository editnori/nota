import { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import { useStore } from '../hooks/useStore'
import { getQuestion, loadQuestions } from '../lib/questions'
import { ChevronLeft, ChevronRight, SkipForward, Minus, Plus, Check, Trash2 } from 'lucide-react'

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
  isAdjacent: boolean  // touching but not overlapping
  position: { x: number, y: number }
}

export function DocumentView({ onCreateAnnotation }: Props) {
  // Only subscribe to what we need - avoid subscribing to full annotations array
  const notes = useStore(s => s.notes)
  const currentNoteIndex = useStore(s => s.currentNoteIndex)
  const setCurrentNoteIndex = useStore(s => s.setCurrentNoteIndex)
  const updateAnnotation = useStore(s => s.updateAnnotation)
  const removeAnnotation = useStore(s => s.removeAnnotation)
  const fontSize = useStore(s => s.fontSize)
  const setFontSize = useStore(s => s.setFontSize)
  const highlightedAnnotation = useStore(s => s.highlightedAnnotation)
  const annotationsByNote = useStore(s => s.annotationsByNote)
  
  const note = notes[currentNoteIndex]
  
  // Get annotations for current note only - memoized for performance
  const noteAnnotations = useMemo(() => {
    if (!note) return []
    return annotationsByNote.get(note.id) || []
  }, [note?.id, annotationsByNote])
  
  // For hasUnannotated check - just need size comparison
  const annotationsByNoteSize = annotationsByNote.size
  const notesLength = notes.length
  
  const docRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activeSpan, setActiveSpan] = useState<{ annotationIds: string[] } | null>(null)
  const [glowingMarkId, setGlowingMarkId] = useState<string | null>(null)
  const [spanEditor, setSpanEditor] = useState<SpanEditor | null>(null)
  const [overlapPrompt, setOverlapPrompt] = useState<OverlapPrompt | null>(null)
  
  // Use ref for popup position so it doesn't shift when annotations update
  const popupPositionRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 })
  
  // Flag to prevent closing popup immediately after opening
  const justOpenedPopupRef = useRef(false)
  
  // Build annotation ID -> annotation map for O(1) lookups in handlers
  const annotationMap = useMemo(() => {
    const map = new Map<string, typeof noteAnnotations[0]>()
    for (const a of noteAnnotations) {
      map.set(a.id, a)
    }
    return map
  }, [noteAnnotations])
  
  // Check if ANY note is unannotated (simple size comparison)
  const hasUnannotated = annotationsByNoteSize < notesLength
  
  // Find next unannotated note from current position
  const nextUnannotatedIndex = useMemo(() => {
    if (!hasUnannotated) return -1
    
    for (let i = currentNoteIndex + 1; i < notes.length; i++) {
      if (!annotationsByNote.has(notes[i].id)) {
        return i
      }
    }
    return -1
  }, [hasUnannotated, annotationsByNote, notes, currentNoteIndex])

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

  const handleTextSelect = useCallback((e: React.MouseEvent) => {
    const coords = getSelectionCoords()
    if (!coords) return

    const { text, start, end } = coords

    // If span editor is open, update its boundaries instead of creating new annotation
    if (spanEditor) {
      setSpanEditor({ ...spanEditor, currentStart: start, currentEnd: end })
      window.getSelection()?.removeAllRanges()
      e.stopPropagation() // Prevent closing popup
      return
    }

    // Check for overlaps with existing annotations
    const overlapping = noteAnnotations.filter(a => 
      (start < a.end && end > a.start) // Any overlap
    )

    // Also check for adjacent spans (touching but not overlapping)
    const adjacent = noteAnnotations.filter(a =>
      (start === a.end || end === a.start) // Touching
    )

    const nearby = overlapping.length > 0 ? overlapping : adjacent
    const isAdjacent = overlapping.length === 0 && adjacent.length > 0

    if (nearby.length > 0) {
      const primary = nearby[0]
      
      // Get position before clearing selection
      const sel = window.getSelection()
      const range = sel?.getRangeAt(0)
      const rect = range?.getBoundingClientRect()
      
      // Always show popup for overlaps/adjacent - let user decide
      justOpenedPopupRef.current = true
      setOverlapPrompt({
        newStart: start,
        newEnd: end,
        newText: text,
        overlappingId: primary.id,
        overlappingText: primary.text,
        isAdjacent,
        position: { x: rect?.left || 100, y: (rect?.bottom || 100) + 4 }
      })
      window.getSelection()?.removeAllRanges()
      // Reset flag after a tick so subsequent clicks close the popup
      setTimeout(() => { justOpenedPopupRef.current = false }, 100)
      return
    }

    onCreateAnnotation(text, start, end)
    window.getSelection()?.removeAllRanges()
  }, [getSelectionCoords, onCreateAnnotation, spanEditor, noteAnnotations])

  function handleOverlapExtend() {
    if (!overlapPrompt || !note) return
    
    const existing = annotationMap.get(overlapPrompt.overlappingId)
    if (!existing) return
    
    // Extend to cover both (keep same questions)
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

  function handleOverlapMerge() {
    if (!overlapPrompt || !note) return
    
    const existing = annotationMap.get(overlapPrompt.overlappingId)
    if (!existing) return
    
    const { selectedQuestion } = useStore.getState()
    
    // Extend to cover both AND add the selected question
    const newStart = Math.min(overlapPrompt.newStart, existing.start)
    const newEnd = Math.max(overlapPrompt.newEnd, existing.end)
    const newText = note.text.slice(newStart, newEnd)
    
    // Add selected question if not already present
    const newQuestions = selectedQuestion && !existing.questions.includes(selectedQuestion)
      ? [...existing.questions, selectedQuestion]
      : existing.questions
    
    updateAnnotation(overlapPrompt.overlappingId, {
      start: newStart,
      end: newEnd,
      text: newText,
      questions: newQuestions
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
    const ann = annotationMap.get(annId)
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
      const ann = annotationMap.get(annId)
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

  function handleDeleteSpan() {
    if (!activeSpan) return
    activeSpan.annotationIds.forEach(annId => {
      removeAnnotation(annId)
    })
    setActiveSpan(null)
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

  // Memoize segment building for performance
  const segments = useMemo(() => {
    return buildSegments(note.text, noteAnnotations)
  }, [note.text, noteAnnotations])
  
  const questions = loadQuestions()

  return (
    <div className="flex-1 flex flex-col min-w-0">
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

      <div 
        ref={scrollContainerRef} 
        className="flex-1 overflow-y-auto p-4 bg-maple-50 dark:bg-maple-900"
        onClick={() => { 
          // Don't close popup if we just opened it
          if (justOpenedPopupRef.current) return
          setActiveSpan(null)
          setSpanEditor(null)
          setOverlapPrompt(null)
        }}
      >
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
                const ann = annotationMap.get(annId)
                return ann?.questions.includes(q.id)
              })
              
              // Check if this is the only question (can't remove last one)
              const isOnlyQuestion = hasQuestion && activeSpan.annotationIds.every(annId => {
                const ann = annotationMap.get(annId)
                return ann?.questions.length === 1 && ann.questions[0] === q.id
              })
              
              return (
                <button
                  key={q.id}
                  onClick={() => handleToggleQuestion(q.id)}
                  disabled={isOnlyQuestion}
                  className={`text-[9px] px-2 py-1 rounded flex items-center gap-1 ${
                    hasQuestion 
                      ? 'text-white ring-2 ring-offset-1' 
                      : 'text-white opacity-40 hover:opacity-70'
                  } ${isOnlyQuestion ? 'cursor-not-allowed' : ''}`}
                  style={{ 
                    backgroundColor: q.color,
                    // @ts-expect-error CSS variable
                    '--tw-ring-color': q.color
                  }}
                  title={isOnlyQuestion ? 'Cannot remove last question' : hasQuestion ? `Remove "${q.name}"` : `Add "${q.name}"`}
                >
                  <span className="w-2.5 flex items-center justify-center">
                    {hasQuestion && <Check size={10} />}
                  </span>
                  {q.hotkey}. {q.name}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-maple-100 dark:border-maple-700">
            <button
              onClick={handleDeleteSpan}
              className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
              title="Delete this annotation"
            >
              <Trash2 size={11} />
              Delete
            </button>
            <button
              onClick={() => setActiveSpan(null)}
              className="text-[10px] text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Overlap/Adjacent prompt */}
      {overlapPrompt && (() => {
        const existing = annotationMap.get(overlapPrompt.overlappingId)
        const { selectedQuestion } = useStore.getState()
        const selectedQ = selectedQuestion ? getQuestion(selectedQuestion) : null
        const canMerge = selectedQ && existing && selectedQuestion && !existing.questions.includes(selectedQuestion)
        
        return (
          <div
            className="fixed z-50 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded-lg shadow-lg p-3 w-80"
            style={{ left: overlapPrompt.position.x, top: overlapPrompt.position.y }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[11px] text-maple-700 dark:text-maple-200 mb-3">
              Selection {overlapPrompt.isAdjacent ? 'is next to' : 'overlaps'}:
              <span className="block mt-1 text-[10px] text-maple-500 dark:text-maple-400 italic truncate">
                "{overlapPrompt.overlappingText.slice(0, 40)}{overlapPrompt.overlappingText.length > 40 ? '...' : ''}"
              </span>
            </div>
            
            <div className="flex flex-col gap-1.5">
              {canMerge && (
                <button
                  onClick={handleOverlapMerge}
                  className="w-full text-[10px] px-3 py-1.5 bg-maple-800 dark:bg-maple-600 text-white rounded hover:bg-maple-700 dark:hover:bg-maple-500 text-left"
                >
                  <span className="font-medium">Merge</span>
                  <span className="text-maple-300 dark:text-maple-400 ml-1">- extend + add "{selectedQ?.name}"</span>
                </button>
              )}
              <button
                onClick={handleOverlapExtend}
                className={`w-full text-[10px] px-3 py-1.5 rounded text-left ${
                  canMerge 
                    ? 'bg-maple-100 dark:bg-maple-700 text-maple-700 dark:text-maple-200 hover:bg-maple-200 dark:hover:bg-maple-600'
                    : 'bg-maple-800 dark:bg-maple-600 text-white hover:bg-maple-700 dark:hover:bg-maple-500'
                }`}
              >
                <span className="font-medium">Extend</span>
                <span className={canMerge ? 'text-maple-500 dark:text-maple-400 ml-1' : 'text-maple-300 dark:text-maple-400 ml-1'}>
                  - grow existing (keep questions)
                </span>
              </button>
              <button
                onClick={handleOverlapCreate}
                className="w-full text-[10px] px-3 py-1.5 bg-maple-100 dark:bg-maple-700 text-maple-700 dark:text-maple-200 rounded hover:bg-maple-200 dark:hover:bg-maple-600 text-left"
              >
                <span className="font-medium">Separate</span>
                <span className="text-maple-500 dark:text-maple-400 ml-1">- create new annotation</span>
              </button>
              <button
                onClick={handleOverlapCancel}
                className="w-full text-[10px] px-3 py-1.5 text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200 text-left"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      })()}

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

// Optimized segment building - annotations already have source field
function buildSegments(
  text: string, 
  noteAnnotations: { id: string; start: number; end: number; questions: string[]; source?: string }[]
): Segment[] {
  if (noteAnnotations.length === 0) {
    return [{ type: 'plain', text, questions: [], annotationIds: [], isSuggested: false }]
  }

  // Build points array directly (faster than Set for small arrays)
  const points: number[] = [0, text.length]
  for (const a of noteAnnotations) {
    const start = Math.max(0, a.start)
    const end = Math.min(text.length, a.end)
    if (!points.includes(start)) points.push(start)
    if (!points.includes(end)) points.push(end)
  }

  points.sort((a, b) => a - b)
  const segments: Segment[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    const segText = text.slice(start, end)

    // Find covering annotations
    const covering: typeof noteAnnotations = []
    for (const a of noteAnnotations) {
      if (a.start <= start && a.end >= end) {
        covering.push(a)
      }
    }
    
    if (covering.length === 0) {
      segments.push({ type: 'plain', text: segText, questions: [], annotationIds: [], isSuggested: false })
    } else {
      // Collect unique questions
      const questionsSet = new Set<string>()
      const annotationIds: string[] = []
      let isSuggested = false
      
      for (const c of covering) {
        annotationIds.push(c.id)
        for (const q of c.questions) {
          questionsSet.add(q)
        }
        if (c.source === 'suggested') {
          isSuggested = true
        }
      }
      
      segments.push({ 
        type: 'highlight', 
        text: segText, 
        questions: Array.from(questionsSet), 
        annotationIds, 
        isSuggested 
      })
    }
  }

  return segments
}
