import { useState, useMemo } from 'react'
import { useStore } from '../hooks/useStore'
import { loadQuestions, getQuestion } from '../lib/questions'
import { X, Plus, MessageSquare, Check, ChevronUp, ChevronDown, CheckCircle, Trash2 } from 'lucide-react'
import { ENTITY_TYPES, ENTITY_TYPE_META, entityLabel } from '../lib/entityTypes'

interface Props {
  noteId: string
}

export function AnnotationList({ noteId }: Props) {
  // Use individual selectors for better performance
  const removeAnnotation = useStore(s => s.removeAnnotation)
  const updateAnnotation = useStore(s => s.updateAnnotation)
  const setHighlightedAnnotation = useStore(s => s.setHighlightedAnnotation)
  const highlightedAnnotation = useStore(s => s.highlightedAnnotation)
  const annotationsByNote = useStore(s => s.annotationsByNote)
  
  const [editingComment, setEditingComment] = useState<{ id: string, text: string } | null>(null)
  const [addingQuestionTo, setAddingQuestionTo] = useState<string | null>(null)
  const [collapseSuggested, setCollapseSuggested] = useState(false)
  const [collapseManual, setCollapseManual] = useState(false)
  
  // Get annotations for THIS note only - memoized for performance
  const noteAnnotations = useMemo(() => {
    const anns = annotationsByNote.get(noteId) || []
    return [...anns].sort((a, b) => a.start - b.start)
  }, [noteId, annotationsByNote])

  const suggestedAnnotations = useMemo(
    () => noteAnnotations.filter(a => a.source === 'suggested'),
    [noteAnnotations]
  )
  const manualAnnotations = useMemo(
    () => noteAnnotations.filter(a => a.source !== 'suggested'),
    [noteAnnotations]
  )
  
  // Build local annotation map for O(1) lookups
  const annotationMap = useMemo(() => {
    const map = new Map<string, typeof noteAnnotations[0]>()
    for (const a of noteAnnotations) {
      map.set(a.id, a)
    }
    return map
  }, [noteAnnotations])
  
  const questions = loadQuestions()

  // Current annotation index for navigation
  const currentAnnIndex = highlightedAnnotation 
    ? noteAnnotations.findIndex(a => a.id === highlightedAnnotation)
    : -1

  function jumpToAnnotation(annId: string) {
    setHighlightedAnnotation(annId)
  }

  function jumpPrev() {
    if (noteAnnotations.length === 0) return
    const newIndex = currentAnnIndex <= 0 ? noteAnnotations.length - 1 : currentAnnIndex - 1
    setHighlightedAnnotation(noteAnnotations[newIndex].id)
  }

  function jumpNext() {
    if (noteAnnotations.length === 0) return
    const newIndex = currentAnnIndex >= noteAnnotations.length - 1 ? 0 : currentAnnIndex + 1
    setHighlightedAnnotation(noteAnnotations[newIndex].id)
  }

  function handleAddQuestion(annId: string, questionId: string) {
    const ann = annotationMap.get(annId)  // O(1) lookup
    if (ann && !ann.questions.includes(questionId)) {
      updateAnnotation(annId, { questions: [...ann.questions, questionId] })
    }
    setAddingQuestionTo(null)
  }

  function handleRemoveQuestion(annId: string, questionId: string) {
    const ann = annotationMap.get(annId)  // O(1) lookup
    if (ann && ann.questions.length > 1) {
      updateAnnotation(annId, { questions: ann.questions.filter(q => q !== questionId) })
    }
  }

  function startEditingComment(annId: string, currentComment: string) {
    setEditingComment({ id: annId, text: currentComment || '' })
  }

  function submitComment() {
    if (editingComment) {
      updateAnnotation(editingComment.id, { 
        comment: editingComment.text.trim() || undefined 
      })
      setEditingComment(null)
    }
  }

  function cancelComment() {
    setEditingComment(null)
  }

  function promoteAnnotation(annId: string) {
    updateAnnotation(annId, { source: 'manual' })
  }

  function approveAllSuggested() {
    for (const ann of suggestedAnnotations) {
      updateAnnotation(ann.id, { source: 'manual' })
    }
  }

  function rejectAllSuggested() {
    for (const ann of suggestedAnnotations) {
      removeAnnotation(ann.id)
    }
  }

  if (noteAnnotations.length === 0) {
    return (
      <div className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-maple-500 dark:text-maple-400 mb-2">
          Annotations
        </div>
        <div className="text-xs text-maple-400 dark:text-maple-500 p-3 bg-maple-50 dark:bg-maple-700 rounded-lg text-center">
          No annotations yet
        </div>
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-wide text-maple-500 dark:text-maple-400">
          Annotations ({noteAnnotations.length})
        </div>
        
        {/* Navigation controls */}
        <div className="flex items-center gap-0.5 bg-maple-100 dark:bg-maple-700 rounded-full">
          <button
            onClick={jumpPrev}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600"
            title="Previous annotation (scroll)"
          >
            <ChevronUp size={11} />
          </button>
          <span className="text-[9px] text-maple-500 dark:text-maple-400 tabular-nums px-0.5">
            {currentAnnIndex >= 0 ? currentAnnIndex + 1 : '-'}/{noteAnnotations.length}
          </span>
          <button
            onClick={jumpNext}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600"
            title="Next annotation (scroll)"
          >
            <ChevronDown size={11} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[9px] text-maple-500 dark:text-maple-400 mb-3">
        {suggestedAnnotations.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
            Suggested {suggestedAnnotations.length}
          </span>
        )}
        {manualAnnotations.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-maple-100 dark:bg-maple-700 text-maple-600 dark:text-maple-300 border border-maple-200 dark:border-maple-600">
            Manual {manualAnnotations.length}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {suggestedAnnotations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={e => { e.stopPropagation(); setCollapseSuggested(v => !v) }}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300"
              >
                {collapseSuggested ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                Suggested ({suggestedAnnotations.length})
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={e => { e.stopPropagation(); approveAllSuggested() }}
                  className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                  title="Approve all suggested annotations"
                >
                  <CheckCircle size={10} />
                  Approve all
                </button>
                <button
                  onClick={e => { e.stopPropagation(); rejectAllSuggested() }}
                  className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                  title="Delete all suggested annotations"
                >
                  <Trash2 size={10} />
                  Reject all
                </button>
              </div>
            </div>
            {!collapseSuggested && (
              <div className="space-y-2">
                {suggestedAnnotations.map(ann => {
                  const isAddingQuestion = addingQuestionTo === ann.id
                  const isEditingComment = editingComment?.id === ann.id
                  const annQuestions = ann.questions || []
                  const availableQuestions = questions.filter(q => !annQuestions.includes(q.id))
                  const isRadiology = annQuestions.includes('Q6') || Boolean(ann.entityType)
                  const isActive = highlightedAnnotation === ann.id
                  const typeLabel = entityLabel(ann.entityType || undefined)
                  const confPct = ann.confidence !== undefined ? Math.round(ann.confidence * 100) : null
                  
                  return (
                    <div 
                      key={ann.id} 
                      onClick={() => jumpToAnnotation(ann.id)}
                      className={`rounded-lg p-2.5 cursor-pointer transition-all bg-amber-50/60 dark:bg-amber-900/10 border border-dashed border-amber-300 dark:border-amber-700 ${
                        isActive 
                          ? 'ring-2 ring-amber-400 dark:ring-amber-500' 
                          : 'hover:ring-1 hover:ring-amber-300 dark:hover:ring-amber-600'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {annQuestions.map(qid => {
                              const q = getQuestion(qid)
                              return (
                                <span
                                  key={qid}
                                  className="text-[9px] px-2 py-0.5 rounded-full text-white font-medium inline-flex items-center gap-1 group"
                                  style={{ backgroundColor: q?.color || '#888' }}
                                >
                                  {q?.name || qid}
                                  {annQuestions.length > 1 && (
                                    <button
                                      onClick={e => { e.stopPropagation(); handleRemoveQuestion(ann.id, qid) }}
                                      className="opacity-50 hover:opacity-100"
                                      title="Remove question"
                                    >
                                      <X size={8} />
                                    </button>
                                  )}
                                </span>
                              )
                            })}
                            {availableQuestions.length > 0 && (
                              <button
                                onClick={e => { e.stopPropagation(); setAddingQuestionTo(isAddingQuestion ? null : ann.id) }}
                                className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-700"
                                title="Add another question"
                              >
                                <Plus size={10} />
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-700">
                              Suggested{typeLabel ? ` · ${typeLabel}` : ''}{confPct !== null ? ` · ${confPct}%` : ''}
                            </span>
                          </div>
                          
                          {isAddingQuestion && (
                            <div className="flex flex-wrap gap-1 mb-2 p-1.5 bg-white dark:bg-maple-800 rounded border border-maple-200 dark:border-maple-600">
                              {availableQuestions.map(q => (
                                <button
                                  key={q.id}
                                  onClick={e => { e.stopPropagation(); handleAddQuestion(ann.id, q.id) }}
                                  className="text-[8px] px-1.5 py-0.5 rounded text-white hover:opacity-80"
                                  style={{ backgroundColor: q.color }}
                                >
                                  {q.name}
                                </button>
                              ))}
                            </div>
                          )}

                          {isRadiology && (
                            <div className="flex flex-wrap items-center gap-1 mb-1">
                              <span className="text-[9px] text-maple-400 dark:text-maple-500">Type:</span>
                              {ENTITY_TYPES.map(type => {
                                const active = ann.entityType === type
                                const style = ENTITY_TYPE_META[type]
                                return (
                                  <button
                                    key={type}
                                    onClick={e => { e.stopPropagation(); updateAnnotation(ann.id, { entityType: type }) }}
                                    className={`text-[9px] px-2 py-0.5 rounded-full border ${
                                      active ? 'border-solid' : 'border-dashed opacity-60 hover:opacity-100'
                                    }`}
                                    style={{
                                      backgroundColor: style.bg,
                                      color: style.text,
                                      borderColor: style.text
                                    }}
                                  >
                                    {style.label}
                                  </button>
                                )
                              })}
                              <button
                                onClick={e => { e.stopPropagation(); updateAnnotation(ann.id, { entityType: undefined }) }}
                                className="text-[9px] px-2 py-0.5 rounded-full border border-dashed text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
                                title="Clear type"
                              >
                                clear
                              </button>
                            </div>
                          )}
                          
                          <div className="text-[11px] text-maple-700 dark:text-maple-200 break-words leading-relaxed">
                            "{ann.text}"
                          </div>
                          
                          {ann.comment && !isEditingComment && (
                            <div 
                              className="mt-2 text-[10px] text-maple-500 dark:text-maple-400 italic bg-white dark:bg-maple-800 p-1.5 rounded border border-maple-100 dark:border-maple-600 cursor-pointer hover:border-maple-300 dark:hover:border-maple-500"
                              onClick={e => { e.stopPropagation(); startEditingComment(ann.id, ann.comment || '') }}
                              title="Click to edit"
                            >
                              {ann.comment}
                            </div>
                          )}
                          
                          {isEditingComment && (
                            <div className="mt-2" onClick={e => e.stopPropagation()}>
                              <textarea
                                value={editingComment.text}
                                onChange={e => setEditingComment({ ...editingComment, text: e.target.value })}
                                placeholder="Add a comment..."
                                className="w-full text-[10px] p-1.5 bg-white dark:bg-maple-800 border border-maple-300 dark:border-maple-600 rounded resize-none focus:outline-none focus:border-maple-400 dark:text-maple-200"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex gap-1 mt-1">
                                <button
                                  onClick={e => { e.stopPropagation(); submitComment() }}
                                  className="flex items-center gap-1 text-[9px] px-2 py-1 bg-maple-800 dark:bg-maple-600 text-white rounded hover:bg-maple-700 dark:hover:bg-maple-500"
                                >
                                  <Check size={10} />
                                  Save
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); cancelComment() }}
                                  className="text-[9px] px-2 py-1 text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); promoteAnnotation(ann.id) }}
                            className="p-1 text-emerald-600 dark:text-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                            title="Approve suggestion"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); removeAnnotation(ann.id) }}
                            className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Reject suggestion"
                          >
                            <X size={12} />
                          </button>
                          {!ann.comment && !isEditingComment && (
                            <button
                              onClick={e => { e.stopPropagation(); startEditingComment(ann.id, '') }}
                              className="p-1 text-maple-300 dark:text-maple-500 hover:text-maple-500 dark:hover:text-maple-300 hover:bg-maple-100 dark:hover:bg-maple-600 rounded"
                              title="Add comment"
                            >
                              <MessageSquare size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {manualAnnotations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={e => { e.stopPropagation(); setCollapseManual(v => !v) }}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-maple-500 dark:text-maple-400"
              >
                {collapseManual ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                Manual ({manualAnnotations.length})
              </button>
            </div>
            {!collapseManual && (
              <div className="space-y-2">
                {manualAnnotations.map(ann => {
          const isAddingQuestion = addingQuestionTo === ann.id
          const isEditingComment = editingComment?.id === ann.id
          const annQuestions = ann.questions || []
          const availableQuestions = questions.filter(q => !annQuestions.includes(q.id))
          const isRadiology = annQuestions.includes('Q6') || Boolean(ann.entityType)
          
          const isActive = highlightedAnnotation === ann.id
          
          return (
            <div 
              key={ann.id} 
              onClick={() => jumpToAnnotation(ann.id)}
              className={`rounded-lg p-2.5 cursor-pointer transition-all bg-maple-50 dark:bg-maple-700 ${
                isActive 
                  ? 'ring-2 ring-maple-400 dark:ring-maple-500' 
                  : 'hover:ring-1 hover:ring-maple-300 dark:hover:ring-maple-600'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {annQuestions.map(qid => {
                      const q = getQuestion(qid)
                      return (
                        <span
                          key={qid}
                          className="text-[9px] px-2 py-0.5 rounded-full text-white font-medium inline-flex items-center gap-1 group"
                          style={{ backgroundColor: q?.color || '#888' }}
                        >
                          {q?.name || qid}
                          {annQuestions.length > 1 && (
                            <button
                              onClick={e => { e.stopPropagation(); handleRemoveQuestion(ann.id, qid) }}
                              className="opacity-50 hover:opacity-100"
                            >
                              <X size={8} />
                            </button>
                          )}
                        </span>
                      )
                    })}
                    {availableQuestions.length > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); setAddingQuestionTo(isAddingQuestion ? null : ann.id) }}
                        className="text-[9px] px-1.5 py-0.5 rounded-full bg-maple-200 dark:bg-maple-600 text-maple-600 dark:text-maple-200 hover:bg-maple-300 dark:hover:bg-maple-500"
                        title="Add another question"
                      >
                        <Plus size={10} />
                      </button>
                    )}
                  </div>
                  
                  {isAddingQuestion && (
                    <div className="flex flex-wrap gap-1 mb-2 p-1.5 bg-white dark:bg-maple-800 rounded border border-maple-200 dark:border-maple-600">
                      {availableQuestions.map(q => (
                        <button
                          key={q.id}
                          onClick={e => { e.stopPropagation(); handleAddQuestion(ann.id, q.id) }}
                          className="text-[8px] px-1.5 py-0.5 rounded text-white hover:opacity-80"
                          style={{ backgroundColor: q.color }}
                        >
                          {q.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {isRadiology && (
                    <div className="flex flex-wrap items-center gap-1 mb-1">
                      <span className="text-[9px] text-maple-400 dark:text-maple-500">Type:</span>
                      {ENTITY_TYPES.map(type => {
                        const active = ann.entityType === type
                        const style = ENTITY_TYPE_META[type]
                        return (
                          <button
                            key={type}
                            onClick={e => { e.stopPropagation(); updateAnnotation(ann.id, { entityType: type }) }}
                            className={`text-[9px] px-2 py-0.5 rounded-full border ${
                              active ? 'border-solid' : 'border-dashed opacity-60 hover:opacity-100'
                            }`}
                            style={{
                              backgroundColor: style.bg,
                              color: style.text,
                              borderColor: style.text
                            }}
                          >
                            {style.label}
                          </button>
                        )
                      })}
                      <button
                        onClick={e => { e.stopPropagation(); updateAnnotation(ann.id, { entityType: undefined }) }}
                        className="text-[9px] px-2 py-0.5 rounded-full border border-dashed text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
                        title="Clear type"
                      >
                        clear
                      </button>
                    </div>
                  )}
                  
                  <div className="text-[11px] text-maple-700 dark:text-maple-200 break-words leading-relaxed">
                    "{ann.text}"
                  </div>
                  
                  {/* Show existing comment */}
                  {ann.comment && !isEditingComment && (
                    <div 
                      className="mt-2 text-[10px] text-maple-500 dark:text-maple-400 italic bg-white dark:bg-maple-800 p-1.5 rounded border border-maple-100 dark:border-maple-600 cursor-pointer hover:border-maple-300 dark:hover:border-maple-500"
                      onClick={e => { e.stopPropagation(); startEditingComment(ann.id, ann.comment || '') }}
                      title="Click to edit"
                    >
                      {ann.comment}
                    </div>
                  )}
                  
                  {/* Comment editor */}
                  {isEditingComment && (
                    <div className="mt-2" onClick={e => e.stopPropagation()}>
                      <textarea
                        value={editingComment.text}
                        onChange={e => setEditingComment({ ...editingComment, text: e.target.value })}
                        placeholder="Add a comment..."
                        className="w-full text-[10px] p-1.5 bg-white dark:bg-maple-800 border border-maple-300 dark:border-maple-600 rounded resize-none focus:outline-none focus:border-maple-400 dark:text-maple-200"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={e => { e.stopPropagation(); submitComment() }}
                          className="flex items-center gap-1 text-[9px] px-2 py-1 bg-maple-800 dark:bg-maple-600 text-white rounded hover:bg-maple-700 dark:hover:bg-maple-500"
                        >
                          <Check size={10} />
                          Save
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); cancelComment() }}
                          className="text-[9px] px-2 py-1 text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {!ann.comment && !isEditingComment && (
                    <button
                      onClick={e => { e.stopPropagation(); startEditingComment(ann.id, '') }}
                      className="p-1 text-maple-300 dark:text-maple-500 hover:text-maple-500 dark:hover:text-maple-300 hover:bg-maple-100 dark:hover:bg-maple-600 rounded"
                      title="Add comment"
                    >
                      <MessageSquare size={11} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); removeAnnotation(ann.id) }}
                    className="p-1 text-maple-400 dark:text-maple-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="Delete annotation"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
