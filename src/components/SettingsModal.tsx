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

const MODE_INFO: Record<FormatterMode, { icon: typeof Cpu, label: string, desc: string }> = {
  none: { icon: Ban, label: 'None', desc: 'No formatting - keep original text' },
  regex: { icon: Code, label: 'Regex', desc: 'Rule-based (140+ patterns, fast)' },
  model: { icon: Cpu, label: 'BiLSTM Model', desc: 'Neural network (97.5% accuracy, runs locally)' }
}

export function SettingsModal({ onClose }: Props) {
  const { formatterMode, setFormatterMode } = useStore()
  const [questions, setQuestions] = useState<Question[]>(loadQuestions)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  function handleSave() {
    saveQuestions(questions)
    onClose()
    window.location.reload() // reload to apply changes
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
      <div className="bg-white dark:bg-maple-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-maple-200 dark:border-maple-700">
          <h2 className="text-sm font-medium text-maple-800 dark:text-maple-100">Settings</h2>
          <button onClick={onClose} className="text-maple-400 dark:text-maple-500 hover:text-maple-600 dark:hover:text-maple-300">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Formatter Settings */}
          <div className="mb-8">
            <h3 className="text-xs font-medium text-maple-600 dark:text-maple-300 uppercase tracking-wide mb-4">
              Formatter Settings
            </h3>
            
            <div className="space-y-3 mb-4">
              {(Object.keys(MODE_INFO) as FormatterMode[]).map(mode => {
                const { icon: Icon, label, desc } = MODE_INFO[mode]
                const isActive = formatterMode === mode
                return (
                  <button
                    key={mode}
                    onClick={() => setFormatterMode(mode)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      isActive
                        ? 'border-maple-400 dark:border-maple-500 bg-maple-50 dark:bg-maple-700'
                        : 'border-maple-200 dark:border-maple-600 hover:border-maple-300 dark:hover:border-maple-500'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${
                      mode === 'model' ? 'bg-blue-100 dark:bg-blue-900/30' :
                      mode === 'regex' ? 'bg-amber-100 dark:bg-amber-900/30' :
                      'bg-maple-100 dark:bg-maple-700'
                    }`}>
                      <Icon size={16} className={
                        mode === 'model' ? 'text-blue-600 dark:text-blue-400' :
                        mode === 'regex' ? 'text-amber-600 dark:text-amber-400' :
                        'text-maple-500 dark:text-maple-400'
                      } />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-maple-800 dark:text-maple-100">{label}</div>
                      <div className="text-xs text-maple-500 dark:text-maple-400">{desc}</div>
                    </div>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Model info */}
            {formatterMode === 'model' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  The BiLSTM model runs entirely in your browser using ONNX Runtime.
                  No server or Python required!
                </p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-2">
                  Model: 7.8M parameters • Trained on 18,718 LLM-formatted notes • 97.5% accuracy
                </p>
              </div>
            )}
          </div>

          {/* Questions Settings */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-maple-600 dark:text-maple-300 uppercase tracking-wide">Questions</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2 py-1 text-xs text-maple-500 dark:text-maple-400 hover:bg-maple-50 dark:hover:bg-maple-700 rounded"
              >
                <RotateCcw size={12} />
                Reset
              </button>
              <button
                onClick={handleAdd}
                className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-maple-800 dark:bg-maple-600 hover:bg-maple-700 dark:hover:bg-maple-500 rounded"
              >
                <Plus size={12} />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {questions.map(q => (
              <div key={q.id} className="flex items-center gap-3 p-3 bg-maple-50 dark:bg-maple-700 rounded-lg">
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
                  className="w-8 h-8 text-center text-xs font-medium bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
                  placeholder="#"
                />

                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={q.name}
                    onChange={e => handleUpdate(q.id, 'name', e.target.value)}
                    className="px-2 py-1.5 text-xs bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    value={q.hint}
                    onChange={e => handleUpdate(q.id, 'hint', e.target.value)}
                    className="px-2 py-1.5 text-xs bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-600 rounded dark:text-maple-200"
                    placeholder="Hint text"
                  />
                </div>

                <button
                  onClick={() => handleRemove(q.id)}
                  className="p-1.5 text-maple-400 dark:text-maple-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Changes to questions will take effect after saving. Your existing annotations will keep their original question references.
            </p>
          </div>

          {/* Updates Section */}
          <div className="mt-8">
            <UpdateChecker />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-maple-200 dark:border-maple-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-maple-600 dark:text-maple-300 hover:bg-maple-50 dark:hover:bg-maple-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs text-white bg-maple-800 dark:bg-maple-600 hover:bg-maple-700 dark:hover:bg-maple-500 rounded-lg"
          >
            Save Changes
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Questions"
        message="This will reset all questions to their default values.\n\nAny custom questions you've added will be lost."
        confirmText="Reset to Defaults"
        variant="warning"
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
