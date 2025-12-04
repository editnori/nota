import { AlertTriangle, Trash2, X } from 'lucide-react'

interface Props {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel
}: Props) {
  if (!isOpen) return null

  const colors = {
    danger: {
      icon: 'text-red-500',
      button: 'bg-red-600 hover:bg-red-700 text-white',
      iconBg: 'bg-red-100 dark:bg-red-900/30'
    },
    warning: {
      icon: 'text-amber-500',
      button: 'bg-amber-600 hover:bg-amber-700 text-white',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30'
    },
    default: {
      icon: 'text-maple-500',
      button: 'bg-maple-800 hover:bg-maple-700 dark:bg-maple-600 dark:hover:bg-maple-500 text-white',
      iconBg: 'bg-maple-100 dark:bg-maple-700'
    }
  }

  const c = colors[variant]

  return (
    <div 
      className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-[100]"
      onClick={onCancel}
    >
      <div 
        className="bg-white dark:bg-maple-800 rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${c.iconBg}`}>
              {variant === 'danger' ? (
                <Trash2 className={`w-6 h-6 ${c.icon}`} />
              ) : (
                <AlertTriangle className={`w-6 h-6 ${c.icon}`} />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-maple-800 dark:text-maple-100 mb-1">
                {title}
              </h3>
              <p className="text-sm text-maple-600 dark:text-maple-300 whitespace-pre-line">
                {message}
              </p>
            </div>
            <button 
              onClick={onCancel}
              className="text-maple-400 hover:text-maple-600 dark:text-maple-500 dark:hover:text-maple-300"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-maple-50 dark:bg-maple-900/50 border-t border-maple-200 dark:border-maple-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-maple-600 dark:text-maple-300 hover:bg-maple-100 dark:hover:bg-maple-700 rounded-lg"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg ${c.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
