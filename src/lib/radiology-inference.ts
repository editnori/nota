/**
 * Radiology Span Labeler Inference using ONNX Runtime Web
 * 
 * Labels kidney/urinary findings in radiology notes:
 * - STONE_SIZE (e.g., "3 mm", "5x4 mm")
 * - KIDNEY_SIZE
 * - HYDRO (hydronephrosis)
 * - OBSTRUCTION
 * - LATERALITY (left, right, bilateral)
 * - STONE_LOC (location)
 * - URETER
 * - CYST
 */

import * as ort from 'onnxruntime-web/wasm'

export interface RadiologyEntity {
  type: string
  text: string
  start: number
  end: number
  confidence: number
}

// Entity labels (must match training) - simplified for contextual phrases
const ENTITY_LABELS = [
  'O', 'KIDNEY_FINDING', 'STONE', 'HYDRO', 'OBSTRUCTION', 'CYST', 'URETER'
]

// Model state
let session: ort.InferenceSession | null = null
let vocab: { stoi: Record<string, number>; unk_idx: number } | null = null
let loadPromise: Promise<void> | null = null
let loadError: string | null = null

const MODEL_PATH = '/radiology-span.onnx'
const VOCAB_PATH = '/radiology-vocab.json'

/**
 * Initialize the radiology model
 */
export async function initRadiologyModel(): Promise<void> {
  if (loadPromise) return loadPromise
  if (session && vocab) return
  if (loadError) throw new Error(loadError)
  
  loadPromise = (async () => {
    try {
      console.log('[Radiology] Loading model...')
      
      // Load vocabulary
      const vocabResponse = await fetch(VOCAB_PATH)
      if (!vocabResponse.ok) throw new Error(`Failed to load vocab: ${vocabResponse.status}`)
      vocab = await vocabResponse.json()
      console.log(`[Radiology] Vocab loaded: ${Object.keys(vocab!.stoi).length} tokens`)
      
      // Configure ONNX Runtime
      const isDev = import.meta.env.DEV
      ort.env.wasm.wasmPaths = isDev 
        ? '/node_modules/onnxruntime-web/dist/' 
        : '/'
      ort.env.wasm.numThreads = 1
      ort.env.wasm.proxy = false
      
      // Load model
      console.log('[Radiology] Loading ONNX model...')
      session = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'basic'
      })
      console.log('[Radiology] Model loaded successfully')
      
    } catch (error: any) {
      console.error('[Radiology] Failed to load model:', error)
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
 * Tokenize text and track character offsets
 */
function tokenize(text: string): { tokens: string[]; starts: number[]; ends: number[] } {
  const tokens: string[] = []
  const starts: number[] = []
  const ends: number[] = []
  
  const regex = /\S+/g
  let match
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0])
    starts.push(match.index)
    ends.push(match.index + match[0].length)
  }
  
  return { tokens, starts, ends }
}

/**
 * Encode tokens to IDs
 */
function encodeTokens(tokens: string[]): number[] {
  if (!vocab) throw new Error('Vocab not loaded')
  return tokens.map(t => vocab!.stoi[t.toLowerCase()] ?? vocab!.unk_idx)
}

/**
 * Softmax
 */
function softmax(logits: number[]): number[] {
  const max = Math.max(...logits)
  const exps = logits.map(x => Math.exp(x - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(x => x / sum)
}

/**
 * Find word boundaries - expand start/end to complete words
 */
function expandToWordBoundaries(text: string, start: number, end: number): { start: number; end: number } {
  // Expand start to beginning of word (find previous whitespace or start of text)
  while (start > 0 && !/\s/.test(text[start - 1])) {
    start--
  }
  
  // Expand end to end of word (find next whitespace or end of text)
  while (end < text.length && !/\s/.test(text[end])) {
    end++
  }
  
  return { start, end }
}

/**
 * Chain merge spans of the same type until we hit a gap of N consecutive O labels
 * This ensures cohesive spans that don't break mid-phrase
 */
function chainMergeSpans(
  tokens: string[],
  predictions: number[],
  starts: number[],
  ends: number[],
  text: string,
  gapTolerance: number = 3  // Max consecutive O tokens before breaking chain
): RadiologyEntity[] {
  const entities: RadiologyEntity[] = []
  
  let i = 0
  while (i < tokens.length) {
    const pred = predictions[i]
    
    // Skip O labels
    if (pred === 0) {
      i++
      continue
    }
    
    // Found start of entity - begin chain merging
    const entityType = ENTITY_LABELS[pred]
    let chainStart = starts[i]
    let chainEnd = ends[i]
    let totalConfidence = 1
    let tokenCount = 1
    let consecutiveOs = 0
    
    i++
    
    // Keep extending the chain as long as:
    // 1. We see the same entity type, OR
    // 2. We see O labels but haven't exceeded gap tolerance
    while (i < tokens.length) {
      const nextPred = predictions[i]
      
      if (nextPred === 0) {
        // O label - count it but don't break yet
        consecutiveOs++
        if (consecutiveOs > gapTolerance) {
          // Gap too large - break the chain
          break
        }
        i++
      } else if (ENTITY_LABELS[nextPred] === entityType) {
        // Same entity type - extend chain and reset gap counter
        chainEnd = ends[i]
        totalConfidence++
        tokenCount++
        consecutiveOs = 0
        i++
      } else {
        // Different entity type - break the chain
        break
      }
    }
    
    // Expand to word boundaries
    const expanded = expandToWordBoundaries(text, chainStart, chainEnd)
    
    entities.push({
      type: entityType,
      text: text.slice(expanded.start, expanded.end).trim(),
      start: expanded.start,
      end: expanded.end,
      confidence: totalConfidence / tokenCount
    })
  }
  
  return entities
}

/**
 * Second pass: merge adjacent spans of same type that are close together
 */
function mergeAdjacentSpans(entities: RadiologyEntity[], text: string, maxCharGap: number = 50): RadiologyEntity[] {
  if (entities.length <= 1) return entities
  
  const merged: RadiologyEntity[] = []
  let current = { ...entities[0] }
  
  for (let i = 1; i < entities.length; i++) {
    const next = entities[i]
    const gap = next.start - current.end
    
    // Merge if same type and within gap tolerance
    if (next.type === current.type && gap <= maxCharGap) {
      // Extend current to include the gap text and next span
      const expanded = expandToWordBoundaries(text, current.start, next.end)
      current = {
        type: current.type,
        text: text.slice(expanded.start, expanded.end).trim(),
        start: expanded.start,
        end: expanded.end,
        confidence: (current.confidence + next.confidence) / 2
      }
    } else {
      merged.push(current)
      current = { ...next }
    }
  }
  merged.push(current)
  
  return merged
}

/**
 * Extract entities from text using the model
 */
export async function extractRadiologyEntities(text: string): Promise<RadiologyEntity[]> {
  await initRadiologyModel()
  
  if (!session || !vocab) {
    throw new Error('Model not loaded')
  }
  
  const { tokens, starts, ends } = tokenize(text)
  if (tokens.length === 0) return []
  
  // Encode
  const inputIds = encodeTokens(tokens)
  
  // Create tensor
  const inputTensor = new ort.Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)), [1, inputIds.length])
  
  // Run inference
  const results = await session.run({ input_ids: inputTensor })
  const logits = results.logits.data as Float32Array
  
  // Get predictions for each token
  const predictions: number[] = []
  for (let i = 0; i < tokens.length; i++) {
    const logitSlice = Array.from({ length: ENTITY_LABELS.length }, (_, j) => logits[i * ENTITY_LABELS.length + j])
    const probs = softmax(logitSlice)
    
    let maxIdx = 0
    for (let j = 1; j < ENTITY_LABELS.length; j++) {
      if (probs[j] > probs[maxIdx]) maxIdx = j
    }
    predictions.push(maxIdx)
  }
  
  // Step 1: Chain merge with gap tolerance (bridges small O gaps within same entity type)
  const chainMerged = chainMergeSpans(tokens, predictions, starts, ends, text, 3)
  
  // Step 2: Merge adjacent spans of same type (catches nearby related phrases)
  const fullyMerged = mergeAdjacentSpans(chainMerged, text, 30)
  
  return fullyMerged
}
