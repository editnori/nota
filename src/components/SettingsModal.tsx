import { useState } from 'react'
import { X, Plus, Trash2, RotateCcw } from 'lucide-react'
import { loadQuestions, saveQuestions, DEFAULT_QUESTIONS } from '../lib/questions'
import type { Question } from '../lib/types'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const [questions, setQuestions] = useState<Question[]>(loadQuestions)
  const [editingId, setEditingId] = useState<string | null>(null)

  function handleSave() {
    saveQuestions(questions)
    onClose()
    window.location.reload() // reload to apply changes
  }

  function handleReset() {
    if (confirm('Reset to default questions?')) {
      setQuestions(DEFAULT_QUESTIONS)
    }
  }

  function handleUpdate(id: string, field: keyof Question, value: string) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  function handleAdd() {
    const newId = `Q${questions.length + 1}`
    setQuestions([...questions, {
      id: newId,
      name: 'New Question',
      color: '#6b7280',
      hotkey: '',
      hint: ''
    }])
    setEditingId(newId)
  }

  function handleRemove(id: string) {
    setQuestions(qs => qs.filter(q => q.id !== id))
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-maple-200">
          <h2 className="text-sm font-medium text-maple-800">Settings</h2>
          <button onClick={onClose} className="text-maple-400 hover:text-maple-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-maple-600 uppercase tracking-wide">Questions</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2 py-1 text-xs text-maple-500 hover:bg-maple-50 rounded"
              >
                <RotateCcw size={12} />
                Reset
              </button>
              <button
                onClick={handleAdd}
                className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-maple-800 hover:bg-maple-700 rounded"
              >
                <Plus size={12} />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {questions.map(q => (
              <div key={q.id} className="flex items-center gap-3 p-3 bg-maple-50 rounded-lg">
                <input
                  type="color"
                  value={q.color}
                  onChange={e => handleUpdate(q.id, 'color', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                
                <input
                  type="text"
                  value={q.hotkey}
                  onChange={e => handleUpdate(q.id, 'hotkey', e.target.value.slice(0, 1))}
                  className="w-8 h-8 text-center text-xs font-medium bg-white border border-maple-200 rounded"
                  placeholder="#"
                />

                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={q.name}
                    onChange={e => handleUpdate(q.id, 'name', e.target.value)}
                    className="px-2 py-1.5 text-xs bg-white border border-maple-200 rounded"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    value={q.hint}
                    onChange={e => handleUpdate(q.id, 'hint', e.target.value)}
                    className="px-2 py-1.5 text-xs bg-white border border-maple-200 rounded"
                    placeholder="Hint text"
                  />
                </div>

                <button
                  onClick={() => handleRemove(q.id)}
                  className="p-1.5 text-maple-400 hover:text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              Changes to questions will take effect after saving. Your existing annotations will keep their original question references.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-maple-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-maple-600 hover:bg-maple-50 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs text-white bg-maple-800 hover:bg-maple-700 rounded-lg"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
