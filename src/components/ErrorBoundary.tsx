import { Component, ReactNode } from 'react'
import { useStore } from '../hooks/useStore'

type FallbackRender = (error: Error, reset: () => void) => ReactNode

interface Props {
  children: ReactNode
  fallback?: FallbackRender
}

interface State {
  error: Error | null
  errorInfo: string | null
  retryCount: number
}

/**
 * Lightweight error boundary to prevent the app from going blank after
 * unexpected runtime errors (e.g., during imports or drag-drop).
 * Provides multiple recovery options.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null, retryCount: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: any) {
    // Log full error details for debugging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: info?.componentStack,
      timestamp: new Date().toISOString(),
      storeState: (() => {
        try {
          const state = useStore.getState()
          return {
            notesCount: state.notes?.length ?? 'undefined',
            annotationsCount: state.annotations?.length ?? 'undefined',
            isLoaded: state.isLoaded,
            isImporting: state.isImporting,
            mode: state.mode
          }
        } catch { return 'failed to get state' }
      })()
    }
    console.error('App crashed:', errorDetails)
    
    // Store simplified info for display
    this.setState({ 
      errorInfo: info?.componentStack?.split('\n').slice(0, 5).join('\n') || null 
    })
  }

  private tryAgain = () => {
    // Just clear the error and let React try to re-render
    this.setState(s => ({ error: null, errorInfo: null, retryCount: s.retryCount + 1 }))
  }

  private resetState = () => {
    // Clear user session to recover from bad state
    try {
      useStore.getState().clearSession()
    } catch (err) {
      console.error('Failed to reset store after error', err)
    }
    this.setState({ error: null, errorInfo: null, retryCount: 0 })
  }

  render() {
    const { error, errorInfo, retryCount } = this.state
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.resetState)
      }
      
      // Check if this is a hooks-related error
      const isHooksError = error.message?.includes('hook') || 
                          error.message?.includes('300') || 
                          error.message?.includes('310')
      
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-maple-50 dark:bg-maple-900 text-maple-700 dark:text-maple-200 p-6">
          <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm mb-4 text-center max-w-md">
            {isHooksError 
              ? 'A rendering error occurred. This sometimes happens during rapid state changes.'
              : 'The app hit an unexpected error.'}
          </p>
          
          {/* Show error details */}
          <details className="mb-4 text-xs text-maple-500 dark:text-maple-400 max-w-lg w-full">
            <summary className="cursor-pointer hover:text-maple-700 dark:hover:text-maple-200">
              Error details (click to expand)
            </summary>
            <pre className="mt-2 p-2 bg-maple-100 dark:bg-maple-800 rounded text-[10px] overflow-auto max-h-48 whitespace-pre-wrap">
              {error.message}
              {errorInfo && `\n\nComponent stack:\n${errorInfo}`}
            </pre>
          </details>
          
          <div className="flex gap-3 flex-wrap justify-center">
            {retryCount < 3 && (
              <button
                onClick={this.tryAgain}
                className="px-4 py-2 text-sm bg-maple-600 text-white rounded-lg hover:bg-maple-500"
              >
                Try Again {retryCount > 0 && `(${retryCount}/3)`}
              </button>
            )}
            <button
              onClick={this.resetState}
              className="px-4 py-2 text-sm bg-maple-800 dark:bg-maple-600 text-white rounded-lg hover:bg-maple-700 dark:hover:bg-maple-500"
            >
              Reset Session
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm border border-maple-200 dark:border-maple-600 rounded-lg hover:bg-maple-100 dark:hover:bg-maple-800"
            >
              Reload Page
            </button>
          </div>
          
          {retryCount >= 3 && (
            <p className="mt-4 text-xs text-maple-400">
              Multiple retries failed. Try "Reset Session" or "Reload Page".
            </p>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
