import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg p-6">
          <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-danger" />
            <h1 className="mb-2 text-xl font-semibold text-fg">Something went wrong</h1>
            <p className="mb-6 text-sm text-fg-muted">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-primary px-6 py-2 text-sm font-medium text-primary-fg transition hover:opacity-90"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
