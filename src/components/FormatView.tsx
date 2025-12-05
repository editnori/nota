import { useState, useRef } from 'react'
import { Download, FileText, Loader2, ChevronLeft, ChevronRight, ArrowDownToLine, Eye } from 'lucide-react'
import { useStore } from '../hooks/useStore'
import { downloadFile } from '../lib/exporters'
import { formatNoteText } from '../lib/importers'

interface ProcessedNote {
  name: string
  raw: string
  formatted: string
}

export function FormatView() {
  const { notes } = useStore()
  const [processed, setProcessed] = useState<ProcessedNote[]>([])
  const [processing, setProcessing] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Process files selected via file picker (for batch download workflow)
  async function handleFiles(files: FileList | null) {
    if (!files) return
    const txtFiles = Array.from(files).filter(f => f.name.endsWith('.txt'))
    if (txtFiles.length === 0) return
    
    setProcessing(true)
    
    const BATCH_SIZE = 20
    const results: ProcessedNote[] = []
    
    for (let i = 0; i < txtFiles.length; i += BATCH_SIZE) {
      const batch = txtFiles.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const raw = await file.text()
          const formatted = formatNoteText(raw)
          return { name: file.name, raw, formatted }
        })
      )
      results.push(...batchResults)
    }

    setProcessed(results)
    setPreviewIndex(0)
    setProcessing(false)
  }

  async function downloadAll() {
    const DOWNLOAD_BATCH = 5
    for (let i = 0; i < processed.length; i += DOWNLOAD_BATCH) {
      const batch = processed.slice(i, i + DOWNLOAD_BATCH)
      await Promise.all(
        batch.map(({ name, formatted }) => 
          downloadFile(formatted, `formatted_${name}`, 'text/plain')
        )
      )
    }
  }

  function clearAll() {
    setProcessed([])
    setPreviewIndex(0)
  }

  // Load notes from Annotator to view original vs formatted comparison
  function loadFromAnnotator() {
    if (notes.length === 0) return
    
    const annotatorNotes: ProcessedNote[] = notes.map(note => ({
      name: note.id + '.txt',
      raw: note.meta?.rawText || note.text,
      formatted: note.text
    }))
    
    setProcessed(annotatorNotes)
    setPreviewIndex(0)
  }

  const currentPreview = processed[previewIndex]
  const hasAnnotatorNotes = notes.length > 0
  const isFromAnnotator = processed.length > 0 && processed[0]?.name === notes[0]?.id + '.txt'

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-maple-200 dark:border-maple-700 bg-white dark:bg-maple-800">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div>
            <h2 className="text-sm font-medium text-maple-800 dark:text-maple-100">Format Comparison</h2>
            <p className="text-xs text-maple-500 dark:text-maple-400">
              {hasAnnotatorNotes 
                ? 'Compare original vs formatted notes' 
                : 'Import notes first, then view formatting here'}
            </p>
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

          {hasAnnotatorNotes && (
            <button
              onClick={loadFromAnnotator}
              disabled={isFromAnnotator}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg ${
                isFromAnnotator
                  ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                  : 'text-maple-600 dark:text-maple-300 border border-maple-200 dark:border-maple-600 hover:bg-maple-50 dark:hover:bg-maple-700'
              }`}
              title="Compare raw vs formatted for imported notes"
            >
              <Eye size={14} />
              {isFromAnnotator ? `Viewing ${notes.length} notes` : `Compare Notes (${notes.length})`}
            </button>
          )}

          {/* Batch download workflow - select files to format & download */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 dark:text-maple-300 border border-maple-200 dark:border-maple-600 rounded-lg hover:bg-maple-50 dark:hover:bg-maple-700 disabled:opacity-50"
          >
            {processing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {processing ? 'Processing...' : 'Format & Preview Files'}
          </button>

          {processed.length > 0 && !isFromAnnotator && (
            <button
              onClick={downloadAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-maple-800 dark:bg-maple-600 rounded-lg hover:bg-maple-700 dark:hover:bg-maple-500"
            >
              <Download size={14} />
              Download All
            </button>
          )}

          {processed.length > 0 && (
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-xs text-maple-500 dark:text-maple-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-maple-50 dark:bg-maple-900 relative">
        {processed.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <Eye className="mx-auto mb-4 text-maple-300 dark:text-maple-600" size={48} />
              {hasAnnotatorNotes ? (
                <>
                  <p className="text-maple-600 dark:text-maple-300 mb-2 font-medium">
                    {notes.length} notes ready to compare
                  </p>
                  <p className="text-xs text-maple-500 dark:text-maple-400 mb-4">
                    Click "Compare Notes" to see original vs formatted side-by-side
                  </p>
                  <button
                    onClick={loadFromAnnotator}
                    className="px-4 py-2 text-xs text-white bg-maple-800 dark:bg-maple-600 rounded-lg hover:bg-maple-700 dark:hover:bg-maple-500"
                  >
                    Compare Notes
                  </button>
                </>
              ) : (
                <>
                  <p className="text-maple-500 dark:text-maple-400 mb-1">No notes imported yet</p>
                  <p className="text-xs text-maple-400 dark:text-maple-500">
                    Drag-drop files anywhere to import with auto-formatting
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-maple-50 dark:bg-maple-800 border-b border-maple-200 dark:border-maple-700">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                  disabled={previewIndex === 0}
                  className="p-1 rounded hover:bg-maple-200 dark:hover:bg-maple-700 disabled:opacity-30"
                >
                  <ChevronLeft size={16} className="text-maple-600 dark:text-maple-300" />
                </button>
                <span className="text-xs text-maple-600 dark:text-maple-300 font-medium">
                  {previewIndex + 1} / {processed.length}
                </span>
                <button
                  onClick={() => setPreviewIndex(i => Math.min(processed.length - 1, i + 1))}
                  disabled={previewIndex === processed.length - 1}
                  className="p-1 rounded hover:bg-maple-200 dark:hover:bg-maple-700 disabled:opacity-30"
                >
                  <ChevronRight size={16} className="text-maple-600 dark:text-maple-300" />
                </button>
              </div>
              <span className="text-xs text-maple-500 dark:text-maple-400">{currentPreview?.name}</span>
            </div>
            
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 flex flex-col border-r border-maple-200 dark:border-maple-700">
                <div className="px-4 py-2 bg-maple-100 dark:bg-maple-700 border-b border-maple-200 dark:border-maple-600">
                  <span className="text-[10px] uppercase tracking-wide text-maple-500 dark:text-maple-400 font-medium">
                    Original (Raw Input)
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-white dark:bg-maple-800">
                  <pre className="text-[11px] text-maple-600 dark:text-maple-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {currentPreview?.raw}
                  </pre>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800">
                  <span className="text-[10px] uppercase tracking-wide text-green-700 dark:text-green-400 font-medium">
                    Formatted
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-green-50/30 dark:bg-green-900/10">
                  <pre className="text-[11px] text-maple-700 dark:text-maple-200 font-mono whitespace-pre-wrap leading-relaxed">
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
