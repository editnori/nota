import { loadQuestions } from '../lib/questions'
import { useStore } from '../hooks/useStore'

interface Props {
  onSelect: (questionId: string) => void
}

export function QuestionPicker({ onSelect }: Props) {
  const { selectedQuestion, setSelectedQuestion } = useStore()
  const questions = loadQuestions()

  function handleClick(qid: string) {
    setSelectedQuestion(qid)
    onSelect(qid)
  }

  return (
    <div className="p-3 border-b border-maple-100 dark:border-maple-700">
      <div className="text-[10px] uppercase tracking-wide text-maple-500 dark:text-maple-400 mb-3">
        Select question (or press 1-0)
      </div>
      <div className="space-y-1.5">
        {questions.map(q => {
          const isSelected = selectedQuestion === q.id
          return (
            <button
              key={q.id}
              onClick={() => handleClick(q.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                isSelected 
                  ? 'ring-2 ring-offset-1 dark:ring-offset-maple-800' 
                  : 'hover:bg-maple-50 dark:hover:bg-maple-700'
              }`}
              style={{
                backgroundColor: isSelected ? `${q.color}15` : undefined,
                // @ts-expect-error ring color via CSS variable
                '--tw-ring-color': isSelected ? q.color : undefined
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shadow-sm"
                style={{ backgroundColor: q.color }}
              >
                {q.hotkey}
              </span>
              <div className="flex-1 min-w-0">
                <div 
                  className="text-[12px] font-medium"
                  style={{ color: isSelected ? q.color : undefined }}
                >
                  <span className={isSelected ? '' : 'text-maple-700 dark:text-maple-200'}>
                    {q.name}
                  </span>
                </div>
                <div className="text-[10px] text-maple-400 dark:text-maple-500 truncate">{q.hint}</div>
              </div>
              {isSelected && (
                <span 
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: q.color, color: 'white' }}
                >
                  active
                </span>
              )}
            </button>
          )
        })}
      </div>
      
      {selectedQuestion && (
        <div className="mt-3 p-2 bg-maple-50 dark:bg-maple-700 rounded-lg">
          <p className="text-[10px] text-maple-500 dark:text-maple-400 text-center">
            Highlight text to tag with selected question
          </p>
        </div>
      )}
    </div>
  )
}
