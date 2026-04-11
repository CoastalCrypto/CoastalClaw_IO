import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Coastal.AI] Unhandled render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#050a0f' }}>
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-6 opacity-40">⚠</div>
          <h1 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Something went wrong
          </h1>
          <p className="text-sm mb-6" style={{ color: '#A0AEC0' }}>
            An unexpected error occurred. Reload the page to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary px-6 py-2 text-sm mb-6"
          >
            Reload page
          </button>
          <details className="text-left">
            <summary className="text-xs font-mono cursor-pointer" style={{ color: 'rgba(255,255,255,0.30)' }}>
              Error details
            </summary>
            <pre className="mt-2 text-xs p-3 rounded-lg overflow-auto max-h-40"
              style={{ background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.20)', color: '#ff6b6b', fontFamily: 'JetBrains Mono, monospace' }}>
              {this.state.error.message}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
