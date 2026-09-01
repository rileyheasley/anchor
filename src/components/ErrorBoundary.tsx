import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Rendered inside the fallback body, above the reload button — e.g. "This canvas failed to load." */
  message: string
  /** 'reload-app' reloads the whole window; 'reset' just re-mounts children (for a scoped boundary). */
  recovery: 'reload-app' | 'reset'
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRecover = () => {
    if (this.props.recovery === 'reload-app') {
      window.location.reload()
    } else {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center gap-3 p-10 text-center h-full w-full bg-surface">
        <p className="font-heading text-lg text-ink">Something went wrong</p>
        <p className="text-sm text-ink-muted max-w-sm">{this.props.message}</p>
        <button
          onClick={this.handleRecover}
          className="mt-2 px-4 py-2 bg-primary text-ink-inverse text-sm rounded-lg font-medium hover:bg-primary-hover transition-colors cursor-pointer"
        >
          {this.props.recovery === 'reload-app' ? 'Reload' : 'Try again'}
        </button>
      </div>
    )
  }
}
