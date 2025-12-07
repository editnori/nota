/**
 * BiLSTM Clinical Note Formatter
 * 
 * Three formatting modes:
 * 1. "none" - No formatting (passthrough)
 * 2. "regex" - Rule-based formatter (140+ patterns)
 * 3. "model" - BiLSTM neural network (runs locally via ONNX)
 */

import { formatNoteText as regexFormatNote } from './formatter'
import { formatWithModel, isModelLoaded, initModel, preloadModel, getLoadError } from './bilstm-inference'
import type { FormatterMode, FormatExplanation } from './types'

export interface FormatterOptions {
  mode: FormatterMode
  explain?: boolean
}

export interface FormatResult {
  formatted: string
  mode: FormatterMode
  explanation?: FormatExplanation
  error?: string
}

/**
 * Format a clinical note using the specified mode
 */
export async function formatNote(
  rawText: string,
  options: FormatterOptions = { mode: 'regex' }
): Promise<FormatResult> {
  const { mode, explain = false } = options

  switch (mode) {
    case 'none':
      return { formatted: rawText, mode: 'none' }
    case 'regex':
      return { formatted: regexFormatNote(rawText), mode: 'regex' }
    case 'model':
      return formatWithLocalModel(rawText, explain)
    default:
      throw new Error(`Unknown formatter mode: ${mode}`)
  }
}

async function formatWithLocalModel(rawText: string, explain: boolean): Promise<FormatResult> {
  try {
    const result = await formatWithModel(rawText)
    return {
      formatted: result.formatted,
      mode: 'model',
      explanation: explain ? result.explanation : undefined,
    }
  } catch (error: any) {
    console.error('Model error, falling back to regex:', error)
    return { 
      formatted: regexFormatNote(rawText), 
      mode: 'regex',
      error: `Model error: ${error.message || 'Unknown'} - using regex fallback`
    }
  }
}

export const isModelReady = isModelLoaded
export const getModelError = getLoadError
export { preloadModel }

export async function initializeModel(): Promise<boolean> {
  try {
    await initModel()
    return true
  } catch {
    return false
  }
}

export type { FormatterMode, FormatExplanation }
