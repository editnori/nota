/**
 * BiLSTM Model Inference in TypeScript using ONNX Runtime Web
 * 
 * This runs the formatting model entirely in the browser/Electron - no Python needed!
 */

// Import WASM-only bundle to avoid WebGPU (jsep) module loading issues
import * as ort from 'onnxruntime-web/wasm'
import type { FormatExplanation, TokenExplanation, SectionType, LineType } from './types'

// Model and vocab will be loaded once
let session: ort.InferenceSession | null = null
let vocab: { stoi: Record<string, number>; itos: string[]; pad_idx: number; unk_idx: number } | null = null
let loadPromise: Promise<void> | null = null
let loadError: string | null = null

const MODEL_PATH = '/bilstm-formatter.onnx'
const VOCAB_PATH = '/bilstm-vocab.json'

/**
 * Initialize the ONNX model and vocabulary
 */
export async function initModel(): Promise<void> {
  // Prevent multiple simultaneous loads
  if (loadPromise) return loadPromise
  if (session && vocab) return
  if (loadError) throw new Error(loadError)
  
  loadPromise = (async () => {
    try {
      console.log('[BiLSTM] Loading model...')
      
      // Load vocabulary first (it's smaller and faster)
      const vocabResponse = await fetch(VOCAB_PATH)
      if (!vocabResponse.ok) throw new Error(`Failed to load vocab: ${vocabResponse.status}`)
      vocab = await vocabResponse.json()
      console.log(`[BiLSTM] Vocab loaded: ${vocab!.itos.length} tokens`)
      
      // Configure ONNX Runtime
      // Point to node_modules during dev, public folder in production
      const isDev = import.meta.env.DEV
      ort.env.wasm.wasmPaths = isDev 
        ? '/node_modules/onnxruntime-web/dist/' 
        : '/'
      
      // Disable multi-threading to avoid worker module loading issues
      ort.env.wasm.numThreads = 1
      
      // Disable proxy mode - runs WASM in main thread, avoids .mjs worker imports
      ort.env.wasm.proxy = false
      
      // Load ONNX model
      console.log('[BiLSTM] Loading ONNX model...')
      session = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'basic'
      })
      console.log('[BiLSTM] Model loaded successfully')
      
    } catch (error: any) {
      console.error('[BiLSTM] Failed to load model:', error)
      loadError = error.message || 'Unknown error'
      session = null
      vocab = null
      throw error
    } finally {
      loadPromise = null
    }
  })()
  
  return loadPromise
}

/**
 * Check if model is loaded and ready
 */
export function isModelLoaded(): boolean {
  return session !== null && vocab !== null
}

/**
 * Encode tokens to IDs using vocabulary
 */
function encodeTokens(tokens: string[]): number[] {
  if (!vocab) throw new Error('Vocab not loaded')
  return tokens.map(t => vocab!.stoi[t] ?? vocab!.unk_idx)
}

/**
 * Softmax function for probability calculation
 */
function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits)
  const exps = logits.map(x => Math.exp(x - maxLogit))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(x => x / sum)
}

/**
 * Calculate entropy of probability distribution
 * 0 = certain (one option is 100%), ~1.1 = max uncertainty (uniform across 3 classes)
 */
function entropy(probs: number[]): number {
  return -probs.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0)
}

// =============================================================================
// SECTION AND LINE TYPE DETECTION (matches v4 Python logic)
// =============================================================================

const MAJOR_HEADERS = new Set([
  'chief complaint', 'cc', 'history of present illness', 'hpi',
  'past medical history', 'pmh', 'past surgical history', 'psh',
  'social history', 'sh', 'family history', 'fh',
  'review of systems', 'ros', 'physical exam', 'physical examination', 'pe',
  'vital signs', 'vitals', 'vs', 'labs', 'laboratory', 'imaging', 'radiology',
  'assessment', 'assessment and plan', 'a/p', 'plan', 'impression',
  'medications', 'allergies', 'hospital course', 'ed course', 'mdm',
  'diagnosis', 'diagnoses', 'problem list', 'disposition', 'follow up',
  'history', 'subjective', 'objective', 'exam', 'findings', 'results',
])

const MINOR_HEADERS = new Set([
  'constitutional', 'heent', 'head', 'eyes', 'ears', 'nose', 'throat', 'neck',
  'cardiovascular', 'cv', 'cardiac', 'heart', 'respiratory', 'pulmonary', 'lungs',
  'gastrointestinal', 'gi', 'abdominal', 'abdomen', 'genitourinary', 'gu',
  'musculoskeletal', 'msk', 'neurological', 'neuro', 'psychiatric', 'psych',
  'skin', 'integumentary', 'extremities', 'lymphatic',
  'endocrine', 'hematologic', 'immunologic', 'allergic',
])

const SECTION_PATTERNS: [RegExp, SectionType][] = [
  [/^(history\s+of\s+present(ing)?\s+illness|hpi|chief\s+complaint|cc|reason\s+for\s+(visit|consultation)|presenting\s+complaint|subjective)\s*:?$/i, 'HPI'],
  [/^(past\s+medical\s+history|pmh|medical\s+history|patient\s+history)\s*:?$/i, 'PMH'],
  [/^(past\s+surgical\s+history|psh|surgical\s+history)\s*:?$/i, 'PSH'],
  [/^(social\s+history|sh|socioeconomic\s+history|substance\s+use)\s*:?$/i, 'SOCIAL'],
  [/^(family\s+history|fh|family\s+medical\s+history)\s*:?$/i, 'FAMILY'],
  [/^(allergies|allergy|drug\s+allergies|allergen\s+reactions|adverse\s+reactions)\s*:?$/i, 'ALLERGIES'],
  [/^(medications?|current\s+medications?|discharge\s+medications?|home\s+medications?|outpatient\s+medications?|active\s+medications?)\s*:?$/i, 'MEDS'],
  [/^(review\s+of\s+systems|ros|systems\s+review)\s*:?$/i, 'ROS'],
  [/^(physical\s+exam(ination)?|pe|exam(ination)?|physical\s+findings|objective)\s*:?$/i, 'PE'],
  [/^(vital\s+signs|vitals|vs)\s*:?$/i, 'VITALS'],
  [/^(labs?|lab\s+results|laboratory(\s+data|\s+results|\s+studies)?|results)\s*:?$/i, 'LABS'],
  [/^(imaging(\s+studies)?|radiology|diagnostic\s+studies|studies|x.?ray|ct|mri|ultrasound)\s*:?$/i, 'IMAGING'],
  [/^(assessment(\s+and\s+plan)?|a\/?p|impression|diagnosis|diagnoses|ed\s+diagnosis|final\s+diagnos[ie]s|problem\s+list)\s*:?$/i, 'ASSESSMENT'],
  [/^(plan(\s+of\s+care)?|treatment\s+plan|recommendations|disposition|discharge\s+(instructions|plan|disposition)|follow.?up)\s*:?$/i, 'PLAN'],
  [/^(hospital\s+course|ed\s+course|course|mdm|medical\s+decision\s+making)\s*:?$/i, 'COURSE'],
]

function detectSection(text: string): SectionType {
  const normalized = text.toLowerCase().replace(/:$/, '').trim()
  for (const [pattern, section] of SECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return section
    }
  }
  return 'NONE'
}

function detectLineType(lineText: string, isBullet: boolean): LineType {
  const normalized = lineText.toLowerCase().replace(/:$/, '').trim()
  
  if (isBullet) return 'LIST_ITEM'
  if (MAJOR_HEADERS.has(normalized) || detectSection(lineText) !== 'NONE') return 'MAJOR_HEADER'
  if (MINOR_HEADERS.has(normalized)) return 'MINOR_HEADER'
  
  // Table row detection (multiple numbers, pipes, tabs)
  if (/\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*/.test(lineText)) return 'TABLE_ROW'
  if (lineText.includes('|') || lineText.includes('\t')) return 'TABLE_ROW'
  
  return 'NARRATIVE'
}

function isBulletToken(token: string): boolean {
  return /^[-*~•]$/.test(token) || token.startsWith('-') || token.startsWith('*')
}

/**
 * Apply predictions to reconstruct formatted text
 */
function applyLabelsToTokens(tokens: string[], labels: number[]): string {
  const pieces: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    pieces.push(tokens[i])
    if (labels[i] === 2) {
      pieces.push('\n\n')
    } else if (labels[i] === 1) {
      pieces.push('\n')
    } else {
      pieces.push(' ')
    }
  }
  return pieces.join('').trim()
}

/**
 * Format a note using the BiLSTM model
 */
export async function formatWithModel(rawText: string): Promise<{
  formatted: string
  explanation?: FormatExplanation
}> {
  // Ensure model is loaded
  await initModel()
  
  if (!session || !vocab) {
    throw new Error('Model not loaded')
  }
  
  // Tokenize
  const tokens = rawText.split(/\s+/).filter(t => t.length > 0)
  if (tokens.length === 0) {
    return { formatted: rawText }
  }
  
  // Encode
  const inputIds = encodeTokens(tokens)
  
  // Create tensor - use int64 (BigInt64Array)
  const inputTensor = new ort.Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)), [1, inputIds.length])
  
  // Run inference
  const results = await session.run({ input_ids: inputTensor })
  const logits = results.logits.data as Float32Array
  
  // Process outputs: logits shape is [1, seq_len, 3]
  const seqLen = tokens.length
  const predictions: number[] = []
  const confidences: number[] = []
  const explanations: TokenExplanation[] = []
  
  const LABEL_NAMES: ('space' | 'newline' | 'blank_line')[] = ['space', 'newline', 'blank_line']
  
  // Track current section and line context
  let currentSection: SectionType = 'NONE'
  let isAtLineStart = true
  const sectionsFound = new Set<SectionType>()
  let headerCount = 0
  let listItemCount = 0
  
  for (let i = 0; i < seqLen; i++) {
    const logitSlice = [
      logits[i * 3],
      logits[i * 3 + 1],
      logits[i * 3 + 2]
    ]
    
    // Get prediction (argmax)
    let maxIdx = 0
    for (let j = 1; j < 3; j++) {
      if (logitSlice[j] > logitSlice[maxIdx]) maxIdx = j
    }
    predictions.push(maxIdx)
    
    // Get probabilities
    const probs = softmax(logitSlice)
    confidences.push(probs[maxIdx])
    
    const token = tokens[i]
    const decision = LABEL_NAMES[maxIdx]
    
    // Build line text for context (look ahead to next newline/blank_line)
    let lineTokens = [token]
    for (let j = i + 1; j < seqLen && j < i + 10; j++) {
      const futureLogits = [logits[j * 3], logits[j * 3 + 1], logits[j * 3 + 2]]
      const futureMax = futureLogits[0] > futureLogits[1] && futureLogits[0] > futureLogits[2] ? 0 : 
                        futureLogits[1] > futureLogits[2] ? 1 : 2
      lineTokens.push(tokens[j])
      if (futureMax !== 0) break // newline or blank_line
    }
    const lineText = lineTokens.join(' ')
    
    // Detect section from line start
    const isBullet = isAtLineStart && isBulletToken(token)
    let lineType: LineType = 'NARRATIVE'
    
    if (isAtLineStart) {
      const detectedSection = detectSection(lineText)
      if (detectedSection !== 'NONE') {
        currentSection = detectedSection
        sectionsFound.add(detectedSection)
      }
      lineType = detectLineType(lineText, isBullet)
      if (lineType === 'MAJOR_HEADER' || lineType === 'MINOR_HEADER') headerCount++
      if (lineType === 'LIST_ITEM') listItemCount++
    }
    
    // Infer reason
    let reason = 'context'
    if (decision !== 'space') {
      const tokenLower = token.toLowerCase().replace(/:$/, '')
      if (token.endsWith(':')) {
        reason = 'section_header'
      } else if (MAJOR_HEADERS.has(tokenLower) || MINOR_HEADERS.has(tokenLower)) {
        reason = 'section_header'
      } else if (isBullet) {
        reason = 'list_item'
      } else if (['md', 'do', 'np', 'pa', 'rn'].includes(tokenLower)) {
        reason = 'signature'
      } else {
        reason = 'learned_pattern'
      }
    }
    
    // Calculate entropy and check for ambiguity
    const tokenEntropy = entropy(probs)
    const sortedProbs = [...probs].sort((a, b) => b - a)
    const isAmbiguous = sortedProbs[1] >= sortedProbs[0] * 0.8 // 2nd best within 20%
    
    explanations.push({
      token,
      decision,
      confidence: Math.round(probs[maxIdx] * 1000) / 1000,
      reason,
      probs: {
        space: Math.round(probs[0] * 1000) / 1000,
        newline: Math.round(probs[1] * 1000) / 1000,
        blank_line: Math.round(probs[2] * 1000) / 1000
      },
      entropy: Math.round(tokenEntropy * 1000) / 1000,
      ambiguous: isAmbiguous,
      lineType: isAtLineStart ? lineType : 'NARRATIVE',
      section: currentSection,
      isLineStart: isAtLineStart
    })
    
    // Update line start tracking
    isAtLineStart = (decision === 'newline' || decision === 'blank_line')
  }
  
  // Reconstruct formatted text
  const formatted = applyLabelsToTokens(tokens, predictions)
  
  return {
    formatted,
    explanation: {
      tokens,
      predictions,
      confidences: confidences.map(c => Math.round(c * 1000) / 1000),
      explanation: explanations,
      stats: {
        total_tokens: tokens.length,
        spaces: predictions.filter(p => p === 0).length,
        newlines: predictions.filter(p => p === 1).length,
        blank_lines: predictions.filter(p => p === 2).length,
        avg_confidence: Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 1000) / 1000,
        headers: headerCount,
        list_items: listItemCount,
        sections_found: Array.from(sectionsFound)
      }
    }
  }
}
