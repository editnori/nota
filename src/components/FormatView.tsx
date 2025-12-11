import { useState, useRef, useEffect, useCallback } from 'react'
import { Download, FileText, Loader2, ChevronLeft, ChevronRight, Ban, CheckCircle, Minus, Plus } from 'lucide-react'
import { useStore, setBulkOperation } from '../hooks/useStore'
import { downloadFile } from '../lib/exporters'
import { formatNote, isModelReady, initializeModel } from '../lib/bilstm-formatter'
import type { Note, FormatterMode, FormatExplanation, TokenExplanation, SectionType } from '../lib/types'
import { SECTION_STYLES, DEFAULT_SECTION_STYLE } from '../lib/sections'
import { FORMATTER_MODE_CONFIG as MODE_CONFIG } from '../lib/formatterModes'

interface ProcessedNote {
  name: string
  raw: string
  formatted: string
  mode: FormatterMode
  explanation?: FormatExplanation
  error?: string
}

export function FormatView() {
  const notes = useStore(s => s.notes)
  const formatterMode = useStore(s => s.formatterMode)
  const setFormatterMode = useStore(s => s.setFormatterMode)
  const fontSize = useStore(s => s.fontSize)
  const setFontSize = useStore(s => s.setFontSize)
  const [processed, setProcessed] = useState<ProcessedNote[]>([])
  const [processing, setProcessing] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [showModePrompt, setShowModePrompt] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null)
  const [selectedSection, setSelectedSection] = useState<SectionType | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formattedScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (formatterMode === 'model') {
      if (isModelReady()) {
        setModelStatus('ready')
      } else {
        setModelStatus('loading')
        initializeModel().then(success => setModelStatus(success ? 'ready' : 'error'))
      }
    }
  }, [formatterMode])

  const processNote = useCallback(async (raw: string, name: string): Promise<ProcessedNote> => {
    const result = await formatNote(raw, { mode: formatterMode, explain: formatterMode === 'model' })
    return { name, raw, formatted: result.formatted, mode: result.mode, explanation: result.explanation, error: result.error }
  }, [formatterMode])

  async function handleFileSelect(files: FileList | null) {
    if (!files?.length) return
    const txtFiles = Array.from(files).filter(f => f.name.endsWith('.txt'))
    if (!txtFiles.length) return
    setPendingFiles(files)
    setShowModePrompt(true)
  }

  async function processFiles(mode: FormatterMode) {
    if (!pendingFiles) return
    setShowModePrompt(false)
    setFormatterMode(mode)
    setProcessing(true)

    if (mode === 'model' && !isModelReady()) {
      setModelStatus('loading')
      await initializeModel()
      setModelStatus(isModelReady() ? 'ready' : 'error')
    }

    const txtFiles = Array.from(pendingFiles).filter(f => f.name.endsWith('.txt'))
    const results: ProcessedNote[] = []
    
    for (let i = 0; i < txtFiles.length; i += 20) {
      const batch = txtFiles.slice(i, i + 20)
      const batchResults = await Promise.all(batch.map(async f => processNote(await f.text(), f.name)))
      results.push(...batchResults)
    }

    setProcessed(results)
    setPreviewIndex(0)
    setProcessing(false)
    setPendingFiles(null)
  }

  async function loadFromAnnotator() {
    if (!notes.length) return
    setProcessing(true)

    if (formatterMode === 'model' && !isModelReady()) {
      setModelStatus('loading')
      await initializeModel()
      setModelStatus(isModelReady() ? 'ready' : 'error')
    }

    const results = await Promise.all(
      notes.map(note => processNote(note.meta?.rawText || note.text, `${note.id}.txt`))
    )
    
    setProcessed(results)
    setPreviewIndex(0)
    setProcessing(false)
  }

  async function downloadAll() {
    for (let i = 0; i < processed.length; i += 5) {
      const batch = processed.slice(i, i + 5)
      await Promise.all(batch.map(({ name, formatted }) => downloadFile(formatted, `formatted_${name}`, 'text/plain')))
    }
  }

  async function sendToAnnotate() {
    const validProcessed = processed.filter(p => !p.error)
    if (validProcessed.length === 0) return

    const idCounts = new Map<string, number>()
    const formattedNotes: Note[] = validProcessed.map(p => {
      const baseId = p.name.replace(/\.txt$/i, '')
      const count = idCounts.get(baseId) ?? 0
      idCounts.set(baseId, count + 1)
      const id = count === 0 ? baseId : `${baseId}_${count + 1}`
      return {
        id,
        text: p.formatted,
        meta: { source: p.name, rawText: p.raw }
      }
    })

    setBulkOperation(true)
    const state = useStore.getState()
    const hasExisting = state.notes.length > 0 || state.annotations.length > 0

    // If there is already a session, ask whether to append or replace.
    let replaceExisting = false
    if (hasExisting) {
      const add = window.confirm(
        'You already have notes loaded.\n\nOK = Add formatted notes to this session.\nCancel = Replace notes (clears existing annotations).'
      )
      replaceExisting = !add
    }

    if (replaceExisting) {
      useStore.setState({ isTransitioning: true })
      requestAnimationFrame(() => {
        useStore.setState({
          notes: formattedNotes,
          annotations: [],
          annotationsByNote: new Map(),
          annotationsById: new Map(),
          currentNoteIndex: 0,
          selectedQuestion: null,
          undoStack: [],
          filteredNoteIds: null,
          highlightedAnnotation: null,
          isTransitioning: false
        })
      })
    } else {
      const fresh = useStore.getState()
      if (fresh.notes.length > 0) fresh.addNotes(formattedNotes)
      else fresh.setNotes(formattedNotes)
    }

    useStore.getState().setMode('annotate')
    setBulkOperation(false)
  }

  // Toggle section selection and scroll to it
  function toggleSection(section: SectionType) {
    if (!formattedScrollRef.current || !current?.explanation) return
    
    // Toggle selection - click again to deselect
    if (selectedSection === section) {
      setSelectedSection(null)
      return
    }
    
    setSelectedSection(section)
    
    // Scroll to element
    const element = formattedScrollRef.current.querySelector(`[data-section-start="${section}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
  
  // Clear selection when changing notes
  useEffect(() => {
    setSelectedSection(null)
  }, [previewIndex])

  const current = processed[previewIndex]
  const hasAnnotatorNotes = notes.length > 0
  const isFromAnnotator = processed.length > 0 && processed[0]?.name === `${notes[0]?.id}.txt`

  // Extract unique sections in order
  const sectionsInOrder = current?.explanation?.explanation
    .filter((t, i, arr) => t.section !== 'NONE' && t.isLineStart && 
      (i === 0 || arr[i-1].section !== t.section))
    .map(t => t.section) || []

  return (
    <div className="flex-1 flex flex-col">
      {/* Header - matches DocumentView style */}
      <div className="h-10 bg-white dark:bg-maple-800 border-b border-maple-200 dark:border-maple-800 flex items-center px-3 gap-2">
        {/* Mode Selector - pill style */}
        <div className="flex items-center bg-maple-100 dark:bg-maple-700 rounded-full shrink-0">
          {(Object.keys(MODE_CONFIG) as FormatterMode[]).map(mode => {
            const { icon: Icon, label, desc } = MODE_CONFIG[mode]
            const active = formatterMode === mode
            return (
              <button
                key={mode}
                onClick={() => setFormatterMode(mode)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-full transition-all ${
                  active 
                    ? 'bg-white dark:bg-maple-600 text-maple-800 dark:text-white shadow-sm' 
                    : 'text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200'
                }`}
                title={desc}
              >
                <Icon size={11} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Model Status Badge */}
        {formatterMode === 'model' && (
          <span className={`text-[9px] px-2 py-0.5 rounded-full ${
            modelStatus === 'ready' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
            modelStatus === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
            'bg-maple-100 dark:bg-maple-700 text-maple-500'
          }`}>
            {modelStatus === 'ready' && <><CheckCircle size={9} className="inline mr-1" />Ready</>}
            {modelStatus === 'loading' && <><Loader2 size={9} className="inline mr-1 animate-spin" />Loading</>}
            {modelStatus === 'error' && <><Ban size={9} className="inline mr-1" />Error</>}
          </span>
        )}
        
        <div className="flex-1" />

        {/* Font size control */}
        <div className="flex items-center gap-1 bg-maple-100 dark:bg-maple-700 rounded-full px-1">
          <button
            onClick={() => setFontSize(Math.max(9, fontSize - 1))}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600"
          >
            <Minus size={10} />
          </button>
          <span className="text-[9px] text-maple-500 dark:text-maple-400 w-4 text-center">{fontSize}</span>
          <button
            onClick={() => setFontSize(Math.min(18, fontSize + 1))}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600"
          >
            <Plus size={10} />
          </button>
        </div>

        <input ref={fileInputRef} type="file" multiple accept=".txt" onChange={e => handleFileSelect(e.target.files)} className="hidden" />

        {/* Keep load/open actions in the empty state; show here only while previewing */}
        {processed.length > 0 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-maple-600 dark:text-maple-300 bg-maple-100 dark:bg-maple-700 rounded-full hover:bg-maple-200 dark:hover:bg-maple-600 disabled:opacity-50"
          >
            {processing ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
            {processing ? 'Processing...' : 'Open Files'}
          </button>
        )}

        {processed.length > 0 && !isFromAnnotator && (
          <button onClick={sendToAnnotate} disabled={processing} className="btn btn-xs btn-secondary">
            Send to Annotate
          </button>
        )}

        {processed.length > 0 && !isFromAnnotator && (
          <button onClick={downloadAll} className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-white bg-maple-700 dark:bg-maple-600 rounded-full hover:bg-maple-600 dark:hover:bg-maple-500">
            <Download size={11} /> Download
          </button>
        )}

        {processed.length > 0 && (
          <button onClick={() => { setProcessed([]); setPreviewIndex(0) }} className="px-2 py-1 text-[10px] text-maple-400 hover:text-red-500 rounded-full">
            Clear
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden bg-maple-50 dark:bg-maple-900">
        {processed.length === 0 ? (
          <EmptyState 
            hasNotes={hasAnnotatorNotes} 
            noteCount={notes.length} 
            mode={formatterMode}
            onLoad={loadFromAnnotator}
            onOpen={() => fileInputRef.current?.click()}
          />
        ) : (
          <div className="h-full flex flex-col">
            {/* Navigation Bar */}
            <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-maple-800 border-b border-maple-200 dark:border-maple-800">
              {/* Nav Controls */}
              <div className="flex items-center bg-maple-100 dark:bg-maple-700 rounded-full shrink-0">
                <button 
                  onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))} 
                  disabled={previewIndex === 0}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600 disabled:opacity-30"
                >
                  <ChevronLeft size={12} />
                </button>
                <span className="px-1 text-[10px] text-maple-600 dark:text-maple-300 tabular-nums whitespace-nowrap">
                  {previewIndex + 1}/{processed.length}
                </span>
                <button 
                  onClick={() => setPreviewIndex(Math.min(processed.length - 1, previewIndex + 1))} 
                  disabled={previewIndex === processed.length - 1}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-maple-600 disabled:opacity-30"
                >
                  <ChevronRight size={12} />
                </button>
              </div>

              <span className="text-[11px] text-maple-600 dark:text-maple-300 truncate max-w-40">{current?.name}</span>
              
              {/* Mode Badge */}
              {current?.mode && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                  current.mode === 'model' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400' :
                  current.mode === 'regex' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                  'bg-maple-100 dark:bg-maple-700 text-maple-500'
                }`}>
                  {MODE_CONFIG[current.mode].label}
                </span>
              )}

              <div className="flex-1" />

              {/* Clickable Section Pills - fixed width items to prevent jitter */}
              {sectionsInOrder.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-lg scrollbar-none">
                  <span className="text-[9px] text-maple-400 dark:text-maple-500 shrink-0 mr-1">Sections:</span>
                  {sectionsInOrder.map((section, i) => {
                    const style = SECTION_STYLES[section] || DEFAULT_SECTION_STYLE
                    const isSelected = selectedSection === section
                    return (
                      <button
                        key={`${section}-${i}`}
                        onClick={() => toggleSection(section)}
                        className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 transition-all ${
                          isSelected 
                            ? `${style.bg} ${style.text} ${style.border} ring-2 ring-offset-1 ring-current font-medium`
                            : `${style.bg} ${style.text} ${style.border} hover:opacity-80`
                        }`}
                      >
                        {section}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Error Banner */}
            {current?.error && (
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-2 border-b border-amber-200 dark:border-amber-800">
                <Ban size={11} /> {current.error}
              </div>
            )}
            
            {/* Two Column View - Card Style */}
            <div className="flex-1 flex min-h-0 p-4 gap-4 overflow-hidden">
              {/* Original Panel */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-800 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
                  <div className="px-4 py-2 border-b border-maple-100 dark:border-maple-800">
                    <span className="text-[10px] uppercase tracking-wider text-maple-500 dark:text-maple-400 font-medium">Original</span>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    <pre 
                      className="text-maple-600 dark:text-maple-300 font-mono whitespace-pre-wrap leading-[1.8]"
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      {current?.raw}
                    </pre>
                  </div>
                </div>
              </div>
              
              {/* Formatted Panel */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="bg-white dark:bg-maple-800 border border-emerald-200 dark:border-emerald-800/50 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
                  <div className="px-4 py-2 border-b border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-900/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-medium">Formatted</span>
                      {current?.explanation?.stats && (
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-500">
                          {current.explanation.stats.newlines + current.explanation.stats.blank_lines} breaks · {current.explanation.stats.headers || 0} headers
                        </span>
                      )}
                    </div>
                  </div>
                  <div ref={formattedScrollRef} className="flex-1 overflow-auto p-4">
                    {current?.explanation ? (
                      <FormattedWithHighlights 
                        explanation={current.explanation} 
                        fontSize={fontSize}
                        selectedSection={selectedSection}
                      />
                    ) : (
                      <pre 
                        className="text-maple-700 dark:text-maple-200 font-mono whitespace-pre-wrap leading-[1.8]"
                        style={{ fontSize: `${fontSize}px` }}
                      >
                        {current?.formatted}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mode Selection Modal */}
      {showModePrompt && (
        <ModePromptModal 
          fileCount={pendingFiles?.length || 0}
          onSelect={processFiles}
          onCancel={() => { setShowModePrompt(false); setPendingFiles(null) }}
        />
      )}
    </div>
  )
}

// --- Sub-components ---

function EmptyState({
  hasNotes,
  noteCount,
  mode,
  onLoad,
  onOpen
}: {
  hasNotes: boolean
  noteCount: number
  mode: FormatterMode
  onLoad: () => void
  onOpen: () => void
}) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-maple-200 dark:bg-maple-700 flex items-center justify-center">
          <FileText className="text-maple-400 dark:text-maple-500" size={24} />
        </div>
        {hasNotes ? (
          <>
            <p className="text-sm text-maple-700 dark:text-maple-200 mb-1">{noteCount} notes ready</p>
            <p className="text-xs text-maple-500 dark:text-maple-400 mb-4">
              Compare original vs {MODE_CONFIG[mode].label} formatted
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={onLoad}
                className="px-4 py-2 text-xs text-white bg-maple-700 dark:bg-maple-600 rounded-full hover:bg-maple-600"
              >
                Load Notes
              </button>
              <button
                onClick={onOpen}
                className="px-4 py-2 text-xs text-maple-700 dark:text-maple-200 bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-800 rounded-full hover:bg-maple-50 dark:hover:bg-maple-700"
              >
                Open Files
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-maple-600 dark:text-maple-300 mb-1">No notes loaded</p>
            <p className="text-xs text-maple-400 dark:text-maple-500 mb-4">Open .txt files to format</p>
            <button
              onClick={onOpen}
              className="px-4 py-2 text-xs text-white bg-maple-700 dark:bg-maple-600 rounded-full hover:bg-maple-600"
            >
              Open Files
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function FormattedWithHighlights({ explanation, fontSize, selectedSection }: { 
  explanation: FormatExplanation
  fontSize: number
  selectedSection: SectionType | null
}) {
  const tokens = explanation.explanation
  let lastSection: SectionType = 'NONE'
  
  return (
    <div className="font-mono leading-[1.8]" style={{ fontSize: `${fontSize}px` }}>
      {tokens.map((item, i) => {
        const isNewSection = item.section !== 'NONE' && item.section !== lastSection && item.isLineStart
        if (item.section !== 'NONE') lastSection = item.section
        
        // Check if this token is in the selected section
        const isInSelectedSection = selectedSection !== null && item.section === selectedSection
        
        return (
          <span key={i}>
            {/* Section marker for scroll targets */}
            {isNewSection && (
              <span data-section-start={item.section} className="inline" />
            )}
            <Token 
              item={item} 
              isInSelectedSection={isInSelectedSection}
              isNewSection={isNewSection}
            />
            {item.decision === 'newline' && <br />}
            {item.decision === 'blank_line' && <><br /><br /></>}
            {item.decision === 'space' && ' '}
          </span>
        )
      })}
    </div>
  )
}

function Token({ item, isInSelectedSection, isNewSection }: { 
  item: TokenExplanation
  isInSelectedSection: boolean
  isNewSection: boolean
}) {
  const isBreak = item.decision !== 'space'
  const isHeader = item.lineType === 'MAJOR_HEADER' || item.lineType === 'MINOR_HEADER'
  const isListItem = item.lineType === 'LIST_ITEM'
  
  // Get section style
  const sectionStyle = item.section !== 'NONE' ? SECTION_STYLES[item.section] : null
  
  // Build class
  let className = 'text-maple-700 dark:text-maple-200'
  
  if (isInSelectedSection && sectionStyle) {
    // Highlight all tokens in selected section with soft background
    className = `${sectionStyle.bg} ${sectionStyle.text} transition-colors`
    if (isNewSection) {
      // Make section header more prominent
      className += ` font-semibold border-b-2 ${sectionStyle.border}`
    }
  } else if (isNewSection && sectionStyle) {
    // Section header styling - subtle underline
    className = `${sectionStyle.text} font-medium border-b-2 ${sectionStyle.border}`
  } else if (isHeader && item.isLineStart) {
    className = 'text-violet-700 dark:text-violet-300 font-semibold'
  } else if (isListItem && item.isLineStart) {
    className = 'text-orange-700 dark:text-orange-400'
  } else if (isBreak) {
    className = item.decision === 'newline'
      ? 'bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 rounded px-0.5'
      : 'bg-sky-100/60 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200 rounded px-0.5'
  }
  
  // Ambiguous indicator
  if (item.ambiguous && isBreak) {
    className += ' ring-1 ring-amber-400 dark:ring-amber-500'
  }

  // Tooltip
  const tooltipParts: string[] = []
  if (isBreak) {
    const label = item.decision === 'newline' ? 'Newline' : 'Paragraph break'
    tooltipParts.push(`${label} (${Math.round(item.confidence * 100)}%)`)
  }
  if (item.lineType !== 'NARRATIVE' && item.isLineStart) tooltipParts.push(`Type: ${item.lineType}`)
  if (item.section !== 'NONE') tooltipParts.push(`Section: ${item.section}`)
  if (item.ambiguous) tooltipParts.push('Ambiguous')
  
  return (
    <span 
      className={`${className} ${tooltipParts.length ? 'cursor-help' : ''}`} 
      title={tooltipParts.length ? tooltipParts.join('\n') : undefined}
    >
      {item.token}
    </span>
  )
}

function ModePromptModal({ fileCount, onSelect, onCancel }: { fileCount: number; onSelect: (m: FormatterMode) => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-maple-800 rounded-xl shadow-xl w-full max-w-sm p-5">
        <h3 className="text-sm font-semibold text-maple-800 dark:text-maple-100 mb-1">Select Formatter</h3>
        <p className="text-xs text-maple-500 dark:text-maple-400 mb-4">Processing {fileCount} file(s)</p>
        
        <div className="space-y-2 mb-4">
          {(Object.keys(MODE_CONFIG) as FormatterMode[]).map(mode => {
            const { icon: Icon, label, desc } = MODE_CONFIG[mode]
            const colorClass = mode === 'model' ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20' :
                              mode === 'regex' ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' :
                              'text-maple-500 bg-maple-50 dark:bg-maple-700'
            return (
              <button
                key={mode}
                onClick={() => onSelect(mode)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-maple-200 dark:border-maple-600 hover:border-maple-400 dark:hover:border-maple-500 hover:bg-maple-50 dark:hover:bg-maple-700/50 transition-colors text-left"
              >
                <div className={`p-2 rounded-lg ${colorClass}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <div className="text-sm font-medium text-maple-800 dark:text-maple-100">{label}</div>
                  <div className="text-[10px] text-maple-500 dark:text-maple-400">{desc}</div>
                </div>
              </button>
            )
          })}
        </div>
        
        <div className="flex justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-maple-500 hover:text-maple-700 dark:hover:text-maple-300">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
