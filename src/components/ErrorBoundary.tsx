import { Component, ReactNode } from 'react'
import { useStore } from '../hooks/useStore'

type FallbackRender = (error: Error, reset: () => void) => ReactNode

interface Props {
  children: ReactNode
  fallback?: FallbackRender
}

interface State {
  error: Error | null
}

/**
 * Lightweight error boundary to prevent the app from going blank after
 * unexpected runtime errors (e.g., during imports or drag-drop).
 * Provides a reset that clears the session so users can recover without a full reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: any) {
    console.error('App crashed', error, info)
  }

  private resetState = () => {
    // Attempt to clear user session to recover from bad state
    try {
      useStore.getState().clearSession()
    } catch (err) {
      console.error('Failed to reset store after error', err)
    }
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.resetState)
      }
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-maple-50 dark:bg-maple-900 text-maple-700 dark:text-maple-200 p-6">
          <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm mb-4 text-center max-w-md">
            The app hit an unexpected error. You can reset the session to recover without reloading.
          </p>
          <div className="flex gap-3">
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
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
