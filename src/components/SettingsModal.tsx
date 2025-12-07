import { useState } from 'react'
import { X, Plus, Trash2, RotateCcw, Cpu, Code, Ban } from 'lucide-react'
import { loadQuestions, saveQuestions, DEFAULT_QUESTIONS } from '../lib/questions'
import { ConfirmModal } from './ConfirmModal'
import { UpdateChecker } from './UpdateChecker'
import { useStore } from '../hooks/useStore'
import type { Question, FormatterMode } from '../lib/types'

interface Props {
  onClose: () => void
}

const MODE_INFO: Record<FormatterMode, { icon: typeof Cpu, label: string }> = {
  none: { icon: Ban, label: 'None' },
  regex: { icon: Code, label: 'Regex' },
  model: { icon: Cpu, label: 'BiLSTM' }
}

export function SettingsModal({ onClose }: Props) {
  const { formatterMode, setFormatterMode } = useStore()
  const [questions, setQuestions] = useState<Question[]>(loadQuestions)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  function handleSave() {
    saveQuestions(questions)
    onClose()
    window.location.reload()
  }

  function handleReset() {
    setShowResetConfirm(true)
  }
  
  function confirmReset() {
    setQuestions(DEFAULT_QUESTIONS)
    setShowResetConfirm(false)
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
  }

  function handleRemove(id: string) {
    setQuestions(qs => qs.filter(q => q.id !== id))
  }

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-maple-800 rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-maple-200 dark:border-maple-700">
          <h2 className="text-sm font-medium text-maple-800 dark:text-maple-100">Settings</h2>
          <button onClick={onClose} className="p-1 text-maple-400 hover:text-maple-600 dark:hover:text-maple-300 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Formatter Mode */}
          <section>
            <h3 className="text-[11px] font-medium text-maple-500 dark:text-maple-400 uppercase tracking-wide mb-3">
              Formatter
            </h3>
            <div className="flex gap-2">
              {(Object.keys(MODE_INFO) as FormatterMode[]).map(mode => {
                const { icon: Icon, label } = MODE_INFO[mode]
                const isActive = formatterMode === mode
                return (
                  <button
                    key={mode}
                    onClick={() => setFormatterMode(mode)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                      isActive
                        ? 'border-maple-400 dark:border-maple-500 bg-maple-100 dark:bg-maple-700 text-maple-800 dark:text-maple-100'
                        : 'border-maple-200 dark:border-maple-600 text-maple-500 dark:text-maple-400 hover:border-maple-300 dark:hover:border-maple-500'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Questions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-medium text-maple-500 dark:text-maple-400 uppercase tracking-wide">
                Questions
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleReset}
                  className="p-1.5 text-maple-400 hover:text-maple-600 dark:hover:text-maple-300 hover:bg-maple-100 dark:hover:bg-maple-700 rounded"
                  title="Reset to defaults"
                >
                  <RotateCcw size={13} />
                </button>
                <button
                  onClick={handleAdd}
                  className="p-1.5 text-maple-400 hover:text-maple-600 dark:hover:text-maple-300 hover:bg-maple-100 dark:hover:bg-maple-700 rounded"
                  title="Add question"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {questions.map(q => (
                <div key={q.id} className="flex items-center gap-2 p-2 bg-maple-50 dark:bg-maple-700/50 rounded-lg group">
                  <input
                    type="color"
                    value={q.color}
                    onChange={e => handleUpdate(q.id, 'color', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={q.hotkey}
                    onChange={e => handleUpdate(q.id, 'hotkey', e.target.value.slice(0, 1))}
                    className="w-6 h-6 text-center text-[10px] font-medium bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded text-maple-600 dark:text-maple-300"
                    placeholder="#"
                  />
                  <input
                    type="text"
                    value={q.name}
                    onChange={e => handleUpdate(q.id, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded text-maple-700 dark:text-maple-200"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    value={q.hint}
                    onChange={e => handleUpdate(q.id, 'hint', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded text-maple-700 dark:text-maple-200"
                    placeholder="Hint"
                  />
                  <button
                    onClick={() => handleRemove(q.id)}
                    className="p-1 text-maple-300 dark:text-maple-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Updates */}
          <section>
            <UpdateChecker />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-maple-200 dark:border-maple-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-maple-500 dark:text-maple-400 hover:bg-maple-100 dark:hover:bg-maple-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-medium text-white bg-maple-800 dark:bg-maple-600 hover:bg-maple-700 dark:hover:bg-maple-500 rounded-lg"
          >
            Save
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Questions"
        message="Reset all questions to defaults? Custom questions will be lost."
        confirmText="Reset"
        variant="warning"
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
