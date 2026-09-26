import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Last line of defence: a rendering error anywhere in the dashboard shows a
 * readable panel with the message and a reload button, never a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the details in the console for debugging, but do not spam the UI.
    console.error('[WAHJ] render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center p-5">
        <div className="card card-pad max-w-xl">
          <p className="font-arabic text-[12px] text-wahj-gold/90">وهج</p>
          <h1 className="mt-1 font-display text-xl">Something broke while rendering</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-wahj-smoke">
            The dashboard caught the error instead of showing you a blank page. Reloading usually clears it — your imported data and photos are
            untouched.
          </p>
          <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-neg/25 bg-neg/[0.07] p-3 text-[11px] leading-relaxed text-neg">
            {error.message}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary px-3 py-2 text-xs" onClick={() => window.location.reload()}>
              Reload the dashboard
            </button>
            <button
              className="btn px-3 py-2 text-xs"
              onClick={() => {
                try {
                  window.localStorage.clear()
                } catch {
                  /* ignore */
                }
                window.location.reload()
              }}
            >
              Clear local settings &amp; reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
