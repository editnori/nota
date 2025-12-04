import { useStore } from '../hooks/useStore'
import { getQuestion } from '../lib/questions'
import { X } from 'lucide-react'

interface Props {
  noteId: string
}

export function AnnotationList({ noteId }: Props) {
  const { annotations, removeAnnotation } = useStore()
  const noteAnnotations = annotations.filter(a => a.noteId === noteId)

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
        {noteAnnotations.map(ann => (
          <div key={ann.id} className="bg-maple-50 rounded-lg p-2.5">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {ann.questions.map(qid => {
                    const q = getQuestion(qid)
                    return (
                      <span
                        key={qid}
                        className="text-[9px] px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: q?.color || '#888' }}
                      >
                        {q?.name || qid}
                      </span>
                    )
                  })}
                </div>
                <div className="text-[11px] text-maple-700 break-words leading-relaxed">
                  "{ann.text}"
                </div>
              </div>
              <button
                onClick={() => removeAnnotation(ann.id)}
                className="p-1 text-maple-400 hover:text-red-500 hover:bg-red-50 rounded"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
