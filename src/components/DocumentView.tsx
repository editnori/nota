import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import { useStore, getPendingAnnotationsForNote } from '../hooks/useStore'
import { getQuestion, loadQuestions } from '../lib/questions'
import { ChevronLeft, ChevronRight, SkipForward, Minus, Plus, Check, Trash2, LayoutList, Loader2 } from 'lucide-react'
import { formatWithModel, initModel, isModelLoaded } from '../lib/bilstm-inference'
import type { SectionType, TokenExplanation } from '../lib/types'

// Section styling - matches FormatView
const SECTION_STYLES: Partial<Record<SectionType, { bg: string; text: string; border: string; pill: string }>> = {
  'HPI': { bg: 'bg-rose-100/50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-700', pill: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-300' },
  'PMH': { bg: 'bg-amber-100/50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700', pill: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300' },
  'PSH': { bg: 'bg-orange-100/50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-700', pill: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300' },
  'MEDS': { bg: 'bg-emerald-100/50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700', pill: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300' },
  'ALLERGIES': { bg: 'bg-red-100/50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-700', pill: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300' },
  'ROS': { bg: 'bg-blue-100/50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700', pill: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300' },
  'PE': { bg: 'bg-indigo-100/50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-700', pill: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-300' },
  'VITALS': { bg: 'bg-teal-100/50 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-700', pill: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-300' },
  'LABS': { bg: 'bg-cyan-100/50 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300 dark:border-cyan-700', pill: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-300' },
  'IMAGING': { bg: 'bg-purple-100/50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700', pill: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300' },
  'ASSESSMENT': { bg: 'bg-violet-100/50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-300 dark:border-violet-700', pill: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-300' },
  'PLAN': { bg: 'bg-green-100/50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700', pill: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300' },
  'COURSE': { bg: 'bg-pink-100/50 dark:bg-pink-900/20', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-300 dark:border-pink-700', pill: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-300' },
  'SOCIAL': { bg: 'bg-yellow-100/50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-300 dark:border-yellow-700', pill: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300' },
  'FAMILY': { bg: 'bg-lime-100/50 dark:bg-lime-900/20', text: 'text-lime-700 dark:text-lime-300', border: 'border-lime-300 dark:border-lime-700', pill: 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300 border-lime-300' },
}

const DEFAULT_SECTION_STYLE = { bg: 'bg-maple-100/50 dark:bg-maple-700/50', text: 'text-maple-600 dark:text-maple-300', border: 'border-maple-300 dark:border-maple-600', pill: 'bg-maple-100 dark:bg-maple-700 text-maple-600 dark:text-maple-300 border-maple-300' }

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
  // Note: We rely on annotation batching (16ms) for performance instead of useDeferredValue
  // which was causing highlights to not appear during rapid annotation
  // Defensive: handle case where annotationsByNote might not be a Map
  const noteAnnotations = useMemo(() => {
    if (!note || !annotationsByNote?.get) return []
    return annotationsByNote.get(note.id) || []
  }, [note?.id, annotationsByNote])
  
  // For hasUnannotated check - just need size comparison
  // Defensive: handle case where annotationsByNote might not have size property
  const annotationsByNoteSize = annotationsByNote?.size ?? 0
  const notesLength = notes.length
  
  const docRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activeSpan, setActiveSpan] = useState<{ annotationIds: string[] } | null>(null)
  const [glowingMarkId, setGlowingMarkId] = useState<string | null>(null)
  const [spanEditor, setSpanEditor] = useState<SpanEditor | null>(null)
  const [overlapPrompt, setOverlapPrompt] = useState<OverlapPrompt | null>(null)
  const [showSections, setShowSections] = useState(false) // Section badges toggle
  const [sectionTokens, setSectionTokens] = useState<TokenExplanation[] | null>(null)
  const [sectionsLoading, setSectionsLoading] = useState(false)
  const sectionCacheRef = useRef<Map<string, TokenExplanation[]>>(new Map())
  
  // Use ref for popup position so it doesn't shift when annotations update
  const popupPositionRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 })
  
  // Flag to prevent closing popup immediately after opening
  const justOpenedPopupRef = useRef(false)
  
  // Flag to prevent accidental annotation creation when dismissing popup
  const justDismissedPopupRef = useRef(false)
  
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
  // Defensive: handle case where annotationsByNote might not have .has method
  const nextUnannotatedIndex = useMemo(() => {
    if (!hasUnannotated || !annotationsByNote?.has) return -1
    
    for (let i = currentNoteIndex + 1; i < notes.length; i++) {
      const note = notes[i]
      if (note && !annotationsByNote.has(note.id)) {
        return i
      }
    }
    return -1
  }, [hasUnannotated, annotationsByNote, notes, currentNoteIndex])

  // Run BiLSTM section detection when sections are enabled
  useEffect(() => {
    if (!showSections || !note) {
      setSectionTokens(null)
      return
    }

    // Check cache first
    const cached = sectionCacheRef.current.get(note.id)
    if (cached) {
      setSectionTokens(cached)
      return
    }

    // Run BiLSTM model
    setSectionsLoading(true)
    
    const runDetection = async () => {
      try {
        // Initialize model if needed
        if (!isModelLoaded()) {
          await initModel()
        }
        
        // Run inference on the note text
        const result = await formatWithModel(note.text)
        if (result.explanation) {
          const tokens = result.explanation.explanation
          sectionCacheRef.current.set(note.id, tokens)
          setSectionTokens(tokens)
        }
      } catch (err) {
        console.error('[Sections] BiLSTM error:', err)
        setSectionTokens(null)
      } finally {
        setSectionsLoading(false)
      }
    }

    runDetection()
  }, [showSections, note?.id, note?.text])

  // Build section info from BiLSTM output
  const { sectionsInOrder, sectionBadges } = useMemo(() => {
    if (!sectionTokens || !note) {
      return { sectionsInOrder: [], sectionBadges: [] }
    }
    
    const text = note.text
    let textPos = 0
    const badges: { pos: number; section: SectionType }[] = []
    const sectionsFound: SectionType[] = []
    let lastSection: SectionType = 'NONE'
    
    for (let i = 0; i < sectionTokens.length; i++) {
      const token = sectionTokens[i]
      
      // Skip whitespace to find the token
      while (textPos < text.length && /\s/.test(text[textPos])) {
        textPos++
      }
      
      const tokenStart = textPos
      textPos = tokenStart + token.token.length
      
      // Track section transitions for badges
      if (token.section !== 'NONE' && token.section !== lastSection && token.isLineStart) {
        badges.push({ pos: tokenStart, section: token.section })
        if (!sectionsFound.includes(token.section)) {
          sectionsFound.push(token.section)
        }
      }
      lastSection = token.section
    }
    
    return { sectionsInOrder: sectionsFound, sectionBadges: badges }
  }, [sectionTokens, note?.text])

  // Find all badges within a segment range
  const getBadgesInRange = useCallback((start: number, end: number): { pos: number; section: SectionType }[] => {
    if (!showSections || sectionBadges.length === 0) return []
    return sectionBadges.filter(b => b.pos >= start && b.pos < end)
  }, [showSections, sectionBadges])

  // Scroll to a section when clicking toolbar pill
  const scrollToSection = useCallback((section: SectionType) => {
    if (!scrollContainerRef.current || !docRef.current) return
    
    // Find the badge element for this section
    const badge = docRef.current.querySelector(`[data-section="${section}"]`)
    if (badge) {
      badge.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

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
    // Skip if we just dismissed a popup to prevent accidental annotation creation
    if (justDismissedPopupRef.current) {
      justDismissedPopupRef.current = false
      window.getSelection()?.removeAllRanges()
      return
    }
    
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

    // Check for overlaps with existing annotations AND pending annotations
    // Pending annotations are batched and not yet in state, but we need to detect
    // overlaps during rapid highlighting to prevent duplicate annotations
    const pendingAnns = note ? getPendingAnnotationsForNote(note.id) : []
    const allAnnotations = [...noteAnnotations, ...pendingAnns]
    
    const overlapping = allAnnotations.filter(a => 
      (start < a.end && end > a.start) // Any overlap
    )

    // Also check for adjacent spans (touching but not overlapping)
    const adjacent = allAnnotations.filter(a =>
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

    // Clear any existing overlap prompt before creating new annotation
    // This ensures new selections dismiss stale prompts immediately
    if (overlapPrompt) {
      setOverlapPrompt(null)
    }
    
    onCreateAnnotation(text, start, end)
    window.getSelection()?.removeAllRanges()
  }, [getSelectionCoords, onCreateAnnotation, spanEditor, noteAnnotations, overlapPrompt])

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
    justDismissedPopupRef.current = true
    setOverlapPrompt(null)
    // Reset flag after a tick to allow normal operation
    setTimeout(() => { justDismissedPopupRef.current = false }, 100)
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
      <div className="flex-1 flex items-center justify-center bg-maple-50 dark:bg-maple-900">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-maple-200 dark:bg-maple-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-maple-400 dark:text-maple-500">N</span>
          </div>
          <p className="text-maple-600 dark:text-maple-300 font-medium mb-2">No notes loaded</p>
          <p className="text-sm text-maple-500 dark:text-maple-400">Import or drag-drop notes to begin</p>
        </div>
      </div>
    )
  }

  // Memoize segment building for performance
  const segments = useMemo(() => {
    return buildSegments(note.text, noteAnnotations)
  }, [note.text, noteAnnotations])

  // Calculate cumulative positions for each segment
  const segmentPositions = useMemo(() => {
    const positions: number[] = []
    let pos = 0
    for (const seg of segments) {
      positions.push(pos)
      pos += seg.text.length
    }
    return positions
  }, [segments])
  
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

        {/* Clickable Section Pills - click to scroll to section */}
        {showSections && sectionsInOrder.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto max-w-md scrollbar-none">
            {sectionsInOrder.map((section, i) => {
              const style = SECTION_STYLES[section] || DEFAULT_SECTION_STYLE
              return (
                <button
                  key={`${section}-${i}`}
                  onClick={() => scrollToSection(section)}
                  className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 transition-all ${style.pill} hover:opacity-80 hover:ring-1 hover:ring-current`}
                  title={`Jump to ${section}`}
                >
                  {section}
                </button>
              )
            })}
          </div>
        )}

        {/* Section toggle */}
        <button
          onClick={() => setShowSections(!showSections)}
          disabled={sectionsLoading}
          className={`flex items-center gap-1 px-2 py-1 text-[9px] rounded-full transition-colors ${
            showSections 
              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' 
              : 'bg-maple-100 dark:bg-maple-700 text-maple-500 dark:text-maple-400'
          }`}
          title={showSections ? 'Hide sections (BiLSTM)' : 'Detect sections (BiLSTM)'}
        >
          {sectionsLoading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <LayoutList size={11} />
          )}
          <span className="hidden sm:inline">Sections</span>
        </button>

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
              onMouseDown={() => {
                // Dismiss overlap prompt when starting new selection
                // This prevents stale prompts from blocking new highlights
                if (overlapPrompt && !justOpenedPopupRef.current) {
                  justDismissedPopupRef.current = true
                  setOverlapPrompt(null)
                  // Reset flag after a tick - but handleTextSelect will clear it on mouseUp
                  setTimeout(() => { justDismissedPopupRef.current = false }, 100)
                }
              }}
              onMouseUp={handleTextSelect}
            >
              {segments.map((seg, i) => {
                const segStart = segmentPositions[i]
                const segEnd = segStart + seg.text.length
                
                // Find any section badges that should appear in this segment
                const badgesInSeg = getBadgesInRange(segStart, segEnd)
                
                // Render section badge inline (with data-section for scroll targeting)
                const renderBadge = (section: SectionType, key: string) => {
                  const style = SECTION_STYLES[section] || DEFAULT_SECTION_STYLE
                  return (
                    <span
                      key={key}
                      data-section={section}
                      className={`inline-block text-[8px] px-1 py-0.5 rounded font-medium border align-middle mr-0.5 ${style.pill}`}
                      title={section}
                    >
                      {section}
                    </span>
                  )
                }
                
                // For plain segments
                if (seg.type === 'plain') {
                  // If there are badges in this segment, we need to split the text
                  if (badgesInSeg.length > 0) {
                    const parts: React.ReactNode[] = []
                    let lastPos = 0
                    
                    for (let bi = 0; bi < badgesInSeg.length; bi++) {
                      const badge = badgesInSeg[bi]
                      const relativePos = badge.pos - segStart
                      
                      // Text before badge
                      if (relativePos > lastPos) {
                        parts.push(<span key={`t${bi}`}>{seg.text.slice(lastPos, relativePos)}</span>)
                      }
                      
                      // Badge
                      parts.push(renderBadge(badge.section, `b${bi}`))
                      lastPos = relativePos
                    }
                    
                    // Remaining text
                    if (lastPos < seg.text.length) {
                      parts.push(<span key="end">{seg.text.slice(lastPos)}</span>)
                    }
                    
                    return <span key={i}>{parts}</span>
                  }
                  
                  return <span key={i}>{seg.text}</span>
                }
                
                // Annotated segments
                const colors = seg.questions.map(qid => getQuestion(qid)?.color || '#888')
                const primaryColor = colors[0]
                const isSuggested = seg.isSuggested
                const isGlowing = seg.annotationIds.some(id => id === glowingMarkId)
                
                // Create gradient border for multiple questions
                const borderStyle = colors.length > 1
                  ? `linear-gradient(90deg, ${colors.join(', ')})`
                  : primaryColor
                
                // Check for badges at segment start
                const badgesAtStart = badgesInSeg.filter(b => b.pos === segStart)
                
                return (
                  <span key={i} className="relative inline">
                    {badgesAtStart.map((b, bi) => renderBadge(b.section, `badge${bi}`))}
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

  // Use Set for O(1) deduplication instead of O(n) includes()
  const pointsSet = new Set<number>([0, text.length])
  for (const a of noteAnnotations) {
    pointsSet.add(Math.max(0, a.start))
    pointsSet.add(Math.min(text.length, a.end))
  }

  const points = Array.from(pointsSet).sort((a, b) => a - b)
  const segments: Segment[] = []

  // Always sort annotations by start for correct coverage logic
  // (the break optimization below assumes sorted order)
  const sortedAnns = [...noteAnnotations].sort((a, b) => {
    if (a.start === b.start) return a.end - b.end
    return a.start - b.start
  })

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    const segText = text.slice(start, end)

    // Find covering annotations
    const covering: typeof noteAnnotations = []
    for (const a of sortedAnns) {
      // Early exit if annotation starts after segment (since sorted)
      if (a.start > start) break
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
