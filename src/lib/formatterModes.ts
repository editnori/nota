import { Ban, Code, Cpu } from 'lucide-react'
import type { FormatterMode } from './types'

export const FORMATTER_MODE_CONFIG: Record<
  FormatterMode,
  { icon: typeof Cpu; label: string; desc: string }
> = {
  none: { icon: Ban, label: 'None', desc: 'No formatting (raw text)' },
  regex: { icon: Code, label: 'Regex', desc: 'Rule-based formatting (fast)' },
  model: { icon: Cpu, label: 'BiLSTM', desc: 'Neural network (accurate, slower)' }
}

