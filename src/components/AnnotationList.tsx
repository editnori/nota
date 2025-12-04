import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { loadQuestions, getQuestion } from '../lib/questions'
import { X, Plus, MessageSquare, Check } from 'lucide-react'

interface Props {
  noteId: string
}

export function AnnotationList({ noteId }: Props) {
  const { annotations, removeAnnotation, updateAnnotation } = useStore()
  const [editingComment, setEditingComment] = useState<{ id: string, text: string } | null>(null)
  const [addingQuestionTo, setAddingQuestionTo] = useState<string | null>(null)
  const noteAnnotations = annotations.filter(a => a.noteId === noteId)
  const questions = loadQuestions()

  function handleAddQuestion(annId: string, questionId: string) {
    const ann = annotations.find(a => a.id === annId)
    if (ann && !ann.questions.includes(questionId)) {
      updateAnnotation(annId, { questions: [...ann.questions, questionId] })
    }
    setAddingQuestionTo(null)
  }

  function handleRemoveQuestion(annId: string, questionId: string) {
    const ann = annotations.find(a => a.id === annId)
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
      <div className="text-[10px] uppercase tracking-wide text-maple-500 dark:text-maple-400 mb-2">
        Annotations ({noteAnnotations.length})
      </div>
      <div className="space-y-2">
        {noteAnnotations.map(ann => {
          const isAddingQuestion = addingQuestionTo === ann.id
          const isEditingComment = editingComment?.id === ann.id
          const annQuestions = ann.questions || []
          const availableQuestions = questions.filter(q => !annQuestions.includes(q.id))
          const isSuggested = ann.source === 'suggested'
          
          return (
            <div 
              key={ann.id} 
              className={`rounded-lg p-2.5 ${isSuggested ? 'bg-maple-50 dark:bg-maple-700/50 border border-dashed border-maple-300 dark:border-maple-600' : 'bg-maple-50 dark:bg-maple-700'}`}
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
                              onClick={() => handleRemoveQuestion(ann.id, qid)}
                              className="opacity-50 hover:opacity-100"
                            >
                              <X size={8} />
                            </button>
                          )}
                        </span>
                      )
                    })}
                      {isSuggested && (
                        <button
                          onClick={() => promoteAnnotation(ann.id)}
                          className="text-[9px] px-2 py-0.5 rounded-full bg-maple-100 dark:bg-maple-600 text-maple-500 dark:text-maple-300 border border-dashed border-maple-300 dark:border-maple-500 hover:bg-maple-200 dark:hover:bg-maple-500"
                          title="Click to approve (promote to manual)"
                        >
                          auto
                        </button>
                      )}
                    {availableQuestions.length > 0 && (
                      <button
                        onClick={() => setAddingQuestionTo(isAddingQuestion ? null : ann.id)}
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
                          onClick={() => handleAddQuestion(ann.id, q.id)}
                          className="text-[8px] px-1.5 py-0.5 rounded text-white hover:opacity-80"
                          style={{ backgroundColor: q.color }}
                        >
                          {q.name}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-[11px] text-maple-700 dark:text-maple-200 break-words leading-relaxed">
                    "{ann.text}"
                  </div>
                  
                  {/* Show existing comment */}
                  {ann.comment && !isEditingComment && (
                    <div 
                      className="mt-2 text-[10px] text-maple-500 dark:text-maple-400 italic bg-white dark:bg-maple-800 p-1.5 rounded border border-maple-100 dark:border-maple-600 cursor-pointer hover:border-maple-300 dark:hover:border-maple-500"
                      onClick={() => startEditingComment(ann.id, ann.comment || '')}
                      title="Click to edit"
                    >
                      {ann.comment}
                    </div>
                  )}
                  
                  {/* Comment editor */}
                  {isEditingComment && (
                    <div className="mt-2">
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
                          onClick={submitComment}
                          className="flex items-center gap-1 text-[9px] px-2 py-1 bg-maple-800 dark:bg-maple-600 text-white rounded hover:bg-maple-700 dark:hover:bg-maple-500"
                        >
                          <Check size={10} />
                          Save
                        </button>
                        <button
                          onClick={cancelComment}
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
                      onClick={() => startEditingComment(ann.id, '')}
                      className="p-1 text-maple-300 dark:text-maple-500 hover:text-maple-500 dark:hover:text-maple-300 hover:bg-maple-100 dark:hover:bg-maple-600 rounded"
                      title="Add comment"
                    >
                      <MessageSquare size={11} />
                    </button>
                  )}
                  <button
                    onClick={() => removeAnnotation(ann.id)}
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
    </div>
  )
}
