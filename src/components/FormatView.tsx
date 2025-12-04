import { useState, useRef } from 'react'
import { Upload, Download, FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../hooks/useStore'

interface ProcessedNote {
  name: string
  raw: string
  formatted: string
}

export function FormatView() {
  const { addNotes } = useStore()
  const [inputFiles, setInputFiles] = useState<File[]>([])
  const [processed, setProcessed] = useState<ProcessedNote[]>([])
  const [processing, setProcessing] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const txtFiles = Array.from(files).filter(f => f.name.endsWith('.txt'))
    setInputFiles(prev => [...prev, ...txtFiles])
    setProcessed([])
    setPreviewIndex(0)
  }

  async function processFiles() {
    if (inputFiles.length === 0) return
    
    setProcessing(true)
    const results: ProcessedNote[] = []

    for (const file of inputFiles) {
      const raw = await file.text()
      const formatted = formatNoteText(raw)
      results.push({ name: file.name, raw, formatted })
    }

    setProcessed(results)
    setPreviewIndex(0)
    setProcessing(false)
  }

  function downloadAll() {
    processed.forEach(({ name, formatted }) => {
      const blob = new Blob([formatted], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `formatted_${name}`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  function loadToAnnotator() {
    const notes = processed.map(({ name, formatted }) => ({
      id: name.replace(/\.txt$/, ''),
      text: formatted,
      meta: { source: name }
    }))
    addNotes(notes)
    setInputFiles([])
    setProcessed([])
  }

  function clearAll() {
    setInputFiles([])
    setProcessed([])
    setPreviewIndex(0)
  }

  const currentPreview = processed[previewIndex]

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-maple-200 bg-white">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div>
            <h2 className="text-sm font-medium text-maple-800">Format Notes</h2>
            <p className="text-xs text-maple-500">Upload raw clinical notes to clean and format them</p>
          </div>
          
          <div className="flex-1" />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt"
            onChange={e => handleFiles(e.target.files)}
            className="hidden"
          />

          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error
            webkitdirectory=""
            directory=""
            multiple
            onChange={e => handleFiles(e.target.files)}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 border border-maple-200 rounded-lg hover:bg-maple-50"
          >
            <Upload size={14} />
            Add Files
          </button>

          <button
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 border border-maple-200 rounded-lg hover:bg-maple-50"
          >
            <FileText size={14} />
            Add Folder
          </button>

          {inputFiles.length > 0 && !processed.length && (
            <button
              onClick={processFiles}
              disabled={processing}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-white bg-maple-800 rounded-lg hover:bg-maple-700 disabled:opacity-50"
            >
              {processing ? <Loader2 size={14} className="animate-spin" /> : null}
              Format {inputFiles.length} files
            </button>
          )}

          {processed.length > 0 && (
            <>
              <button
                onClick={loadToAnnotator}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-white bg-amber-600 rounded-lg hover:bg-amber-700"
              >
                Load to Annotator
              </button>
              <button
                onClick={downloadAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 border border-maple-200 rounded-lg hover:bg-maple-50"
              >
                <Download size={14} />
                Download All
              </button>
            </>
          )}

          {(inputFiles.length > 0 || processed.length > 0) && (
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-xs text-maple-500 hover:text-red-500 hover:bg-red-50 rounded-lg"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {inputFiles.length === 0 && processed.length === 0 ? (
          <div 
            className="h-full flex items-center justify-center"
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-maple-100') }}
            onDragLeave={e => { e.currentTarget.classList.remove('bg-maple-100') }}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('bg-maple-100'); handleFiles(e.dataTransfer.files) }}
          >
            <div className="text-center">
              <Upload className="mx-auto mb-4 text-maple-300" size={48} />
              <p className="text-maple-500 mb-1">Drop .txt files here</p>
              <p className="text-xs text-maple-400">or use the buttons above to select files</p>
            </div>
          </div>
        ) : inputFiles.length > 0 && processed.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="bg-white border border-maple-200 rounded-xl p-6 max-w-md">
              <div className="text-sm font-medium text-maple-800 mb-3">
                {inputFiles.length} files ready to format
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
                {inputFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-maple-500 py-1">
                    <FileText size={12} />
                    <span className="truncate">{f.name}</span>
                    <span className="text-maple-300 ml-auto">{(f.size / 1024).toFixed(1)}kb</span>
                  </div>
                ))}
              </div>
              <button
                onClick={processFiles}
                disabled={processing}
                className="w-full py-2 text-xs text-white bg-maple-800 rounded-lg hover:bg-maple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : null}
                {processing ? 'Processing...' : 'Format Notes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-maple-50 border-b border-maple-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                  disabled={previewIndex === 0}
                  className="p-1 rounded hover:bg-maple-200 disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-maple-600 font-medium">
                  {previewIndex + 1} / {processed.length}
                </span>
                <button
                  onClick={() => setPreviewIndex(i => Math.min(processed.length - 1, i + 1))}
                  disabled={previewIndex === processed.length - 1}
                  className="p-1 rounded hover:bg-maple-200 disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <span className="text-xs text-maple-500">{currentPreview?.name}</span>
            </div>
            
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 flex flex-col border-r border-maple-200">
                <div className="px-4 py-2 bg-maple-100 border-b border-maple-200">
                  <span className="text-[10px] uppercase tracking-wide text-maple-500 font-medium">Before (Raw)</span>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <pre className="text-[11px] text-maple-600 font-mono whitespace-pre-wrap leading-relaxed">
                    {currentPreview?.raw}
                  </pre>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 bg-green-50 border-b border-green-200">
                  <span className="text-[10px] uppercase tracking-wide text-green-700 font-medium">After (Formatted)</span>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-green-50/30">
                  <pre className="text-[11px] text-maple-700 font-mono whitespace-pre-wrap leading-relaxed">
                    {currentPreview?.formatted}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatNoteText(raw: string): string {
  let text = raw

  // normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n')

  // collapse multiple spaces
  text = text.replace(/[ \t]{2,}/g, ' ')

  // common section headers that should have line breaks before them
  const headers = [
    'CHIEF COMPLAINT', 'CC:', 'HPI:', 'HISTORY OF PRESENT ILLNESS',
    'PAST MEDICAL HISTORY', 'PMH:', 'PAST SURGICAL HISTORY', 'PSH:',
    'MEDICATIONS', 'CURRENT MEDICATIONS', 'ALLERGIES', 'ADVERSE REACTIONS',
    'SOCIAL HISTORY', 'SH:', 'FAMILY HISTORY', 'FH:',
    'REVIEW OF SYSTEMS', 'ROS:', 'SYSTEMS REVIEW',
    'PHYSICAL EXAM', 'PHYSICAL EXAMINATION', 'PE:',
    'VITALS:', 'VITAL SIGNS',
    'LABS:', 'LABORATORY', 'LAB VALUES',
    'IMAGING:', 'RADIOLOGY',
    'ASSESSMENT', 'IMPRESSION',
    'PLAN:', 'PLAN OF CARE', 'TREATMENT PLAN',
    'ASSESSMENT AND PLAN', 'A/P:',
    'RECOMMENDATIONS:',
    'FINDINGS:', 'TECHNIQUE:', 'INDICATION:', 'COMPARISON:',
    'OPERATIVE NOTE', 'OPERATIVE REPORT',
    'PREOPERATIVE DIAGNOSIS', 'POSTOPERATIVE DIAGNOSIS',
    'PROCEDURE:', 'OPERATION:',
    'ANESTHESIA:', 'SURGEON:',
    'EBL:', 'ESTIMATED BLOOD LOSS',
    'COMPLICATIONS:', 'SPECIMENS:',
    'DISPOSITION:', 'DISCHARGE INSTRUCTIONS',
    'FOLLOW UP:', 'FOLLOWUP:'
  ]

  // add line breaks before headers
  headers.forEach(header => {
    const regex = new RegExp(`(?<!\n\n)(?<!\n)(${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    text = text.replace(regex, '\n\n$1')
  })

  // fix common run-together patterns
  text = text.replace(/([a-z])([A-Z]{2,}:)/g, '$1\n\n$2')
  
  // ensure colon headers have content on same line or next
  text = text.replace(/([A-Z]{2,}:)\s*\n\s*\n/g, '$1\n')

  // trim each line
  text = text.split('\n').map(line => line.trim()).join('\n')

  // collapse multiple blank lines again
  text = text.replace(/\n{3,}/g, '\n\n')

  // remove leading/trailing whitespace
  text = text.trim()

  return text
}
