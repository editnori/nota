import { useState } from 'react'
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'up-to-date' | 'error'

const APP_VERSION = '0.5.74'
const GITHUB_REPO = 'editnori/nota'

interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

interface ReleaseInfo {
  version: string
  body: string
  assets: ReleaseAsset[]
  publishedAt: string
}

function compareVersions(current: string, latest: string): number {
  const c = current.replace(/^v/, '').split('.').map(Number)
  const l = latest.replace(/^v/, '').split('.').map(Number)
  
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0
    const lv = l[i] || 0
    if (lv > cv) return 1
    if (lv < cv) return -1
  }
  return 0
}

function getPlatform(): 'windows' | 'macos' | 'linux' | 'unknown' {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

function findAssetForPlatform(assets: ReleaseAsset[]): ReleaseAsset | null {
  const platform = getPlatform()
  
  // Priority order for each platform
  const patterns: Record<string, RegExp[]> = {
    windows: [/\.msi$/i, /\.exe$/i],
    macos: [/\.dmg$/i, /\.app\.tar\.gz$/i],
    linux: [/\.AppImage$/i, /\.deb$/i, /\.tar\.gz$/i]
  }
  
  const platformPatterns = patterns[platform] || []
  
  for (const pattern of platformPatterns) {
    const asset = assets.find(a => pattern.test(a.name))
    if (asset) return asset
  }
  
  return null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function UpdateChecker() {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  async function checkForUpdates() {
    setStatus('checking')
    setError(null)
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { 'Accept': 'application/vnd.github.v3+json' } }
      )
      
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'No releases found' : `GitHub API error: ${response.status}`)
      }
      
      const data = await response.json()
      const latestVersion = data.tag_name.replace(/^v/, '')
      
      if (compareVersions(APP_VERSION, latestVersion) > 0) {
        setRelease({
          version: latestVersion,
          body: data.body || '',
          assets: data.assets || [],
          publishedAt: new Date(data.published_at).toLocaleDateString()
        })
        setStatus('available')
      } else {
        setStatus('up-to-date')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check')
      setStatus('error')
    }
  }

  async function downloadAndInstall() {
    if (!release) return
    
    const asset = findAssetForPlatform(release.assets)
    if (!asset) {
      setError('No installer available for your platform')
      setStatus('error')
      return
    }
    
    setStatus('downloading')
    setProgress(0)
    
    try {
      // Check if we're in Tauri
      const isTauri = '__TAURI__' in window
      
      if (isTauri) {
        // Use Tauri to download and run installer
        const [{ open }, { tempDir, join }, { writeFile }] = await Promise.all([
          import('@tauri-apps/plugin-shell'),
          import('@tauri-apps/api/path'),
          import('@tauri-apps/plugin-fs')
        ])
        
        const tempPath = await tempDir()
        const filePath = await join(tempPath, asset.name)
        
        // Download with fetch and track progress
        const response = await fetch(asset.browser_download_url)
        if (!response.ok) throw new Error(`Download failed: ${response.status}`)
        
        const contentLength = response.headers.get('content-length')
        const total = contentLength ? parseInt(contentLength, 10) : 0
        
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')
        
        const chunks: Uint8Array[] = []
        let loaded = 0
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          loaded += value.length
          if (total > 0) {
            setProgress(Math.round((loaded / total) * 100))
          }
        }
        
        // Combine chunks and write file
        const data = new Uint8Array(loaded)
        let offset = 0
        for (const chunk of chunks) {
          data.set(chunk, offset)
          offset += chunk.length
        }
        
        await writeFile(filePath, data)
        setStatus('installing')
        
        // Run the installer
        const platform = getPlatform()
        if (platform === 'linux') {
          // Linux - make executable first
          const { Command } = await import('@tauri-apps/plugin-shell')
          await Command.create('chmod', ['+x', filePath]).execute()
        }
        
        await open(filePath)
        
        // Close app after starting installer
        setTimeout(() => window.close(), 1000)
        
      } else {
        // Browser fallback - just open download URL
        window.open(asset.browser_download_url, '_blank')
        setStatus('available')
      }
    } catch (err) {
      console.error('Download failed:', err)
      setError(err instanceof Error ? err.message : 'Download failed')
      setStatus('error')
    }
  }

  const asset = release ? findAssetForPlatform(release.assets) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-medium text-maple-500 dark:text-maple-400 uppercase tracking-wide">
          Updates
        </h3>
        <span className="text-[10px] text-maple-400 dark:text-maple-500 font-mono">
          v{APP_VERSION}
        </span>
      </div>

      <div className="p-3 bg-maple-50 dark:bg-maple-700/50 rounded-lg">
        {status === 'idle' && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-maple-600 dark:text-maple-300">
              Check for updates
            </span>
            <button
              onClick={checkForUpdates}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-white bg-maple-700 dark:bg-maple-600 hover:bg-maple-600 dark:hover:bg-maple-500 rounded-md transition-colors"
            >
              <RefreshCw size={12} />
              Check
            </button>
          </div>
        )}

        {status === 'checking' && (
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="text-maple-500 animate-spin" />
            <span className="text-xs text-maple-600 dark:text-maple-300">Checking...</span>
          </div>
        )}

        {status === 'up-to-date' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500" />
              <span className="text-xs text-maple-600 dark:text-maple-300">Up to date</span>
            </div>
            <button
              onClick={checkForUpdates}
              className="text-[10px] text-maple-400 hover:text-maple-600 dark:hover:text-maple-300"
            >
              Recheck
            </button>
          </div>
        )}

        {status === 'available' && release && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-maple-800 dark:text-maple-100">
                  v{release.version}
                </span>
                <span className="text-[10px] text-maple-400 ml-2">
                  {release.publishedAt}
                </span>
              </div>
              {asset && (
                <span className="text-[10px] text-maple-400">
                  {formatBytes(asset.size)}
                </span>
              )}
            </div>
            <button
              onClick={downloadAndInstall}
              disabled={!asset}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-maple-400 rounded-md transition-colors"
            >
              <Download size={12} />
              {asset ? 'Download & Install' : 'No installer available'}
            </button>
          </div>
        )}

        {status === 'downloading' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="text-blue-500 animate-spin" />
              <span className="text-xs text-maple-600 dark:text-maple-300">
                Downloading... {progress}%
              </span>
            </div>
            <div className="h-1 bg-maple-200 dark:bg-maple-600 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'installing' && (
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="text-green-500 animate-spin" />
            <span className="text-xs text-maple-600 dark:text-maple-300">
              Starting installer...
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-500" />
              <span className="text-xs text-maple-600 dark:text-maple-300">
                {error || 'Update failed'}
              </span>
            </div>
            <button
              onClick={checkForUpdates}
              className="text-[10px] text-maple-400 hover:text-maple-600 dark:hover:text-maple-300"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
