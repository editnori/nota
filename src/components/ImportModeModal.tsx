import { Ban, Code, Cpu, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useStore } from '../hooks/useStore'
import { isModelReady, initializeModel } from '../lib/bilstm-formatter'
import type { FormatterMode } from '../lib/types'

const MODE_CONFIG = {
  none: { icon: Ban, label: 'None', desc: 'No formatting (raw text)' },
  regex: { icon: Code, label: 'Regex', desc: 'Rule-based formatting (140+ patterns, fast)' },
  model: { icon: Cpu, label: 'BiLSTM', desc: 'Neural network (97.5% accuracy, slower)' }
} as const

interface Props {
  fileCount: number
  onSelect: (mode: FormatterMode) => void
  onCancel: () => void
}

export function ImportModeModal({ fileCount, onSelect, onCancel }: Props) {
  const { formatterMode } = useStore()
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  // Check model status on mount
  useEffect(() => {
    if (isModelReady()) {
      setModelStatus('ready')
    }
  }, [])

  async function handleSelect(mode: FormatterMode) {
    if (mode === 'model' && !isModelReady()) {
      setModelStatus('loading')
      const success = await initializeModel()
      setModelStatus(success ? 'ready' : 'error')
      if (!success) return // Don't proceed if model failed
    }
    onSelect(mode)
  }

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-maple-800 rounded-lg shadow-xl w-full max-w-sm p-5 mx-4">
        <h3 className="text-sm font-semibold text-maple-800 dark:text-maple-100 mb-1">
          Select Formatter
        </h3>
        <p className="text-xs text-maple-500 dark:text-maple-400 mb-4">
          How should {fileCount} file{fileCount !== 1 ? 's' : ''} be formatted?
        </p>
        
        <div className="space-y-2 mb-4">
          {(Object.keys(MODE_CONFIG) as FormatterMode[]).map(mode => {
            const { icon: Icon, label, desc } = MODE_CONFIG[mode]
            const isDefault = mode === formatterMode
            const isModelLoading = mode === 'model' && modelStatus === 'loading'
            const colorClass = mode === 'model' 
              ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20' 
              : mode === 'regex' 
              ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' 
              : 'text-maple-500 bg-maple-50 dark:bg-maple-700'
            
            return (
              <button
                key={mode}
                onClick={() => handleSelect(mode)}
                disabled={isModelLoading}
                className={`w-full flex items-center gap-3 p-3 rounded-md border transition-colors text-left ${
                  isDefault
                    ? 'border-maple-400 dark:border-maple-500 bg-maple-50 dark:bg-maple-700/50'
                    : 'border-maple-200 dark:border-maple-600 hover:border-maple-400 dark:hover:border-maple-500 hover:bg-maple-50 dark:hover:bg-maple-700/50'
                } disabled:opacity-50`}
              >
                <div className={`p-2 rounded ${colorClass}`}>
                  {isModelLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Icon size={16} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-maple-800 dark:text-maple-100">{label}</span>
                    {isDefault && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-maple-200 dark:bg-maple-600 text-maple-600 dark:text-maple-300">
                        default
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-maple-500 dark:text-maple-400">{desc}</div>
                </div>
              </button>
            )
          })}
        </div>

        {modelStatus === 'error' && (
          <p className="text-xs text-red-500 dark:text-red-400 mb-3">
            Model failed to load. Try Regex instead.
          </p>
        )}
        
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-maple-500 hover:text-maple-700 dark:hover:text-maple-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
