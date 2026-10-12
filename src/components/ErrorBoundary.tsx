import { Component, type ErrorInfo, type ReactNode } from 'react'
import { PERSIST_KEY } from '../lib/queryClient'

/**
 * Fängt Abstürze beim Rendern ab: statt eines leeren Bildschirms gibt es eine
 * Meldung, „Neu laden“ und – falls alte zwischengespeicherte Daten schuld sind –
 * „Zwischenspeicher leeren“. Die Fehlermeldung hilft beim Melden.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App-Absturz', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl">🥚💥</div>
        <h1 className="text-xl font-bold">Da ist etwas schiefgelaufen</h1>
        <p className="max-w-xs text-sm text-cocoa-light">
          Keine Sorge, deine Daten sind gespeichert. Meist hilft Neu laden – sonst den Zwischenspeicher leeren.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <button className="btn-primary" onClick={() => location.reload()}>
            Neu laden
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              try {
                localStorage.removeItem(PERSIST_KEY)
              } catch {
                /* ignore */
              }
              location.reload()
            }}
          >
            Zwischenspeicher leeren & neu laden
          </button>
        </div>
        <code className="max-w-xs break-words rounded-xl bg-sand px-3 py-2 text-left text-[11px] text-cocoa-light">
          {error.message}
        </code>
      </div>
    )
  }
}
