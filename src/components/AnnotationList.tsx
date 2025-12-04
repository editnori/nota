import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { loadQuestions, getQuestion } from '../lib/questions'
import { X, Plus, MessageSquare } from 'lucide-react'

interface Props {
  noteId: string
}

export function AnnotationList({ noteId }: Props) {
  const { annotations, removeAnnotation, updateAnnotation } = useStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  function handleCommentChange(annId: string, comment: string) {
    updateAnnotation(annId, { comment: comment || undefined })
  }

  if (noteAnnotations.length === 0) {
    return (
      <div className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-maple-500 mb-2">
          Annotations
        </div>
        <div className="text-xs text-maple-400 p-3 bg-maple-50 rounded-lg text-center">
          No annotations yet
        </div>
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="text-[10px] uppercase tracking-wide text-maple-500 mb-2">
        Annotations ({noteAnnotations.length})
      </div>
      <div className="space-y-2">
        {noteAnnotations.map(ann => {
          const isExpanded = expandedId === ann.id
          const isAddingQuestion = addingQuestionTo === ann.id
          const availableQuestions = questions.filter(q => !ann.questions.includes(q.id))
          
          return (
            <div key={ann.id} className="bg-maple-50 rounded-lg p-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {ann.questions.map(qid => {
                      const q = getQuestion(qid)
                      return (
                        <span
                          key={qid}
                          className="text-[9px] px-2 py-0.5 rounded-full text-white font-medium inline-flex items-center gap-1 group"
                          style={{ backgroundColor: q?.color || '#888' }}
                        >
                          {q?.name || qid}
                          {ann.questions.length > 1 && (
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
                    {availableQuestions.length > 0 && (
                      <button
                        onClick={() => setAddingQuestionTo(isAddingQuestion ? null : ann.id)}
                        className="text-[9px] px-1.5 py-0.5 rounded-full bg-maple-200 text-maple-600 hover:bg-maple-300"
                        title="Add another question"
                      >
                        <Plus size={10} />
                      </button>
                    )}
                  </div>
                  
                  {isAddingQuestion && (
                    <div className="flex flex-wrap gap-1 mb-2 p-1.5 bg-white rounded border border-maple-200">
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
                  
                  <div className="text-[11px] text-maple-700 break-words leading-relaxed">
                    "{ann.text}"
                  </div>
                  
                  {(ann.comment || isExpanded) && (
                    <div className="mt-2">
                      <textarea
                        value={ann.comment || ''}
                        onChange={e => handleCommentChange(ann.id, e.target.value)}
                        placeholder="Add a comment..."
                        className="w-full text-[10px] p-1.5 bg-white border border-maple-200 rounded resize-none focus:outline-none focus:border-maple-400"
                        rows={2}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {!ann.comment && !isExpanded && (
                    <button
                      onClick={() => setExpandedId(ann.id)}
                      className="p-1 text-maple-300 hover:text-maple-500 hover:bg-maple-100 rounded"
                      title="Add comment"
                    >
                      <MessageSquare size={11} />
                    </button>
                  )}
                  <button
                    onClick={() => removeAnnotation(ann.id)}
                    className="p-1 text-maple-400 hover:text-red-500 hover:bg-red-50 rounded"
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
