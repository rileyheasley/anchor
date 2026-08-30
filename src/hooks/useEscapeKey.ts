import { useEffect, useRef } from 'react'

type EscapeHandler = () => void

// Module-level stack so only the most recently opened popup/panel reacts to Escape.
const escapeStack: EscapeHandler[] = []

function handleGlobalEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const top = escapeStack[escapeStack.length - 1]
  if (top) {
    e.preventDefault()
    top()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleGlobalEscape)
}

// Registers a handler to run on Escape while `enabled`, closing only the top-most consumer.
export function useEscapeKey(handler: EscapeHandler, enabled: boolean = true) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return
    const wrapped = () => handlerRef.current()
    escapeStack.push(wrapped)
    return () => {
      const idx = escapeStack.lastIndexOf(wrapped)
      if (idx !== -1) escapeStack.splice(idx, 1)
    }
  }, [enabled])
}
