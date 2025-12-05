import { useState, useRef, useEffect } from 'react'
import { Upload, Download, FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../hooks/useStore'
import { downloadFile } from '../lib/exporters'
import { formatNoteText } from '../lib/importers'

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
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const dragCountRef = useRef(0)

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const txtFiles = Array.from(files).filter(f => f.name.endsWith('.txt'))
    setInputFiles(prev => [...prev, ...txtFiles])
    setProcessed([])
    setPreviewIndex(0)
  }

  // Window-level drag handlers for FormatView
  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      dragCountRef.current++
      if (dragCountRef.current === 1) {
        setIsDragging(true)
      }
    }
    
    function onDragOver(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }
    
    function onDragLeave(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      dragCountRef.current--
      if (dragCountRef.current <= 0) {
        dragCountRef.current = 0
        setIsDragging(false)
      }
    }
    
    function onDrop(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      dragCountRef.current = 0
      setIsDragging(false)
      
      if (e.dataTransfer?.files) {
        handleFiles(e.dataTransfer.files)
      }
    }
    
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  async function processFiles() {
    if (inputFiles.length === 0) return
    
    setProcessing(true)
    
    // Process files in parallel batches for faster formatting
    const BATCH_SIZE = 20
    const results: ProcessedNote[] = []
    
    for (let i = 0; i < inputFiles.length; i += BATCH_SIZE) {
      const batch = inputFiles.slice(i, i + BATCH_SIZE)
      
      // Process batch in parallel
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
    // Download files in parallel batches (browsers limit concurrent downloads)
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
      <div className="p-4 border-b border-maple-200 dark:border-maple-700 bg-white dark:bg-maple-800">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div>
            <h2 className="text-sm font-medium text-maple-800 dark:text-maple-100">Format Notes</h2>
            <p className="text-xs text-maple-500 dark:text-maple-400">Upload raw clinical notes to clean and format them</p>
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 dark:text-maple-300 border border-maple-200 dark:border-maple-600 rounded-lg hover:bg-maple-50 dark:hover:bg-maple-700"
          >
            <Upload size={14} />
            Add Files
          </button>

          <button
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 dark:text-maple-300 border border-maple-200 dark:border-maple-600 rounded-lg hover:bg-maple-50 dark:hover:bg-maple-700"
          >
            <FileText size={14} />
            Add Folder
          </button>

          {inputFiles.length > 0 && !processed.length && (
            <button
              onClick={processFiles}
              disabled={processing}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-white bg-maple-800 dark:bg-maple-600 rounded-lg hover:bg-maple-700 dark:hover:bg-maple-500 disabled:opacity-50"
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-maple-600 dark:text-maple-300 border border-maple-200 dark:border-maple-600 rounded-lg hover:bg-maple-50 dark:hover:bg-maple-700"
              >
                <Download size={14} />
                Download All
              </button>
            </>
          )}

          {(inputFiles.length > 0 || processed.length > 0) && (
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
        {/* Drag overlay for FormatView */}
        {isDragging && (
          <div className="absolute inset-0 bg-maple-600/30 dark:bg-maple-400/30 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
            <div className="border-4 border-dashed border-maple-600 dark:border-maple-400 rounded-2xl p-12 m-8 bg-maple-100/90 dark:bg-maple-800/90 shadow-2xl text-center animate-pulse">
              <div className="bg-maple-600 dark:bg-maple-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-10 h-10 text-white" />
              </div>
              <p className="text-xl font-semibold text-maple-800 dark:text-maple-100">Drop .txt files here</p>
              <p className="text-sm text-maple-600 dark:text-maple-300 mt-2">Files will be added to format queue</p>
            </div>
          </div>
        )}

        {inputFiles.length === 0 && processed.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Upload className="mx-auto mb-4 text-maple-300 dark:text-maple-600" size={48} />
              <p className="text-maple-500 dark:text-maple-400 mb-1">Drop .txt files here</p>
              <p className="text-xs text-maple-400 dark:text-maple-500">or use the buttons above to select files</p>
            </div>
          </div>
        ) : inputFiles.length > 0 && processed.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="bg-white dark:bg-maple-800 border border-maple-200 dark:border-maple-700 rounded-xl p-6 max-w-md">
              <div className="text-sm font-medium text-maple-800 dark:text-maple-100 mb-3">
                {inputFiles.length} files ready to format
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
                {inputFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-maple-500 dark:text-maple-400 py-1">
                    <FileText size={12} />
                    <span className="truncate">{f.name}</span>
                    <span className="text-maple-300 dark:text-maple-600 ml-auto">{(f.size / 1024).toFixed(1)}kb</span>
                  </div>
                ))}
              </div>
              <button
                onClick={processFiles}
                disabled={processing}
                className="w-full py-2 text-xs text-white bg-maple-800 dark:bg-maple-600 rounded-lg hover:bg-maple-700 dark:hover:bg-maple-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : null}
                {processing ? 'Processing...' : 'Format Notes'}
              </button>
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
                  <span className="text-[10px] uppercase tracking-wide text-maple-500 dark:text-maple-400 font-medium">Before (Raw)</span>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-white dark:bg-maple-800">
                  <pre className="text-[11px] text-maple-600 dark:text-maple-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {currentPreview?.raw}
                  </pre>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800">
                  <span className="text-[10px] uppercase tracking-wide text-green-700 dark:text-green-400 font-medium">After (Formatted)</span>
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
