import { useState } from 'react'
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'error'

// Current app version - should match tauri.conf.json
const APP_VERSION = '0.5.71'
const GITHUB_REPO = 'editnori/nota'

interface ReleaseInfo {
  version: string
  body: string
  url: string
  publishedAt: string
}

function compareVersions(current: string, latest: string): number {
  const c = current.replace(/^v/, '').split('.').map(Number)
  const l = latest.replace(/^v/, '').split('.').map(Number)
  
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0
    const lv = l[i] || 0
    if (lv > cv) return 1  // latest is newer
    if (lv < cv) return -1 // current is newer
  }
  return 0 // same version
}

export function UpdateChecker() {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function checkForUpdates() {
    setStatus('checking')
    setError(null)
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { 'Accept': 'application/vnd.github.v3+json' } }
      )
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No releases found')
        }
        throw new Error(`GitHub API error: ${response.status}`)
      }
      
      const data = await response.json()
      const latestVersion = data.tag_name.replace(/^v/, '')
      
      if (compareVersions(APP_VERSION, latestVersion) > 0) {
        setRelease({
          version: latestVersion,
          body: data.body || 'No release notes available.',
          url: data.html_url,
          publishedAt: new Date(data.published_at).toLocaleDateString()
        })
        setStatus('available')
      } else {
        setStatus('up-to-date')
      }
    } catch (err) {
      console.error('Update check failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to check for updates')
      setStatus('error')
    }
  }

  async function openReleasePage() {
    if (release?.url) {
      try {
        // Dynamic import for Tauri plugin
        const shellModule = await import('@tauri-apps/plugin-shell')
        await shellModule.open(release.url)
      } catch {
        // Fallback for browser: open in new tab
        window.open(release.url, '_blank', 'noopener,noreferrer')
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-maple-600 dark:text-maple-300 uppercase tracking-wide">
          Updates
        </h3>
        <span className="text-xs text-maple-400 dark:text-maple-500">
          v{APP_VERSION}
        </span>
      </div>

      <div className="p-4 bg-maple-50 dark:bg-maple-700 rounded-lg">
        {status === 'idle' && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-maple-600 dark:text-maple-300">
              Check for new versions
            </span>
            <button
              onClick={checkForUpdates}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-maple-800 dark:bg-maple-600 hover:bg-maple-700 dark:hover:bg-maple-500 rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
              Check for Updates
            </button>
          </div>
        )}

        {status === 'checking' && (
          <div className="flex items-center gap-3">
            <Loader2 size={18} className="text-maple-500 animate-spin" />
            <span className="text-sm text-maple-600 dark:text-maple-300">
              Checking GitHub for updates...
            </span>
          </div>
        )}

        {status === 'up-to-date' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-green-500" />
              <span className="text-sm text-maple-600 dark:text-maple-300">
                You're running the latest version!
              </span>
            </div>
            <button
              onClick={checkForUpdates}
              className="text-xs text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
            >
              Check again
            </button>
          </div>
        )}

        {status === 'available' && release && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Download size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-maple-800 dark:text-maple-100">
                  Version {release.version} is available!
                </p>
                <p className="text-xs text-maple-400 dark:text-maple-500 mt-0.5">
                  Released {release.publishedAt}
                </p>
                {release.body && (
                  <p className="text-xs text-maple-500 dark:text-maple-400 mt-2 whitespace-pre-wrap line-clamp-4">
                    {release.body}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={openReleasePage}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <ExternalLink size={14} />
              Download from GitHub
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="text-amber-500" />
              <div>
                <p className="text-sm text-maple-600 dark:text-maple-300">
                  Couldn't check for updates
                </p>
                {error && (
                  <p className="text-xs text-maple-400 dark:text-maple-500 mt-0.5">
                    {error}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={checkForUpdates}
              className="text-xs text-maple-500 dark:text-maple-400 hover:text-maple-700 dark:hover:text-maple-200"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
