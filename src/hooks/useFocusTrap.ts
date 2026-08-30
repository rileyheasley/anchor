import { useEffect, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Focuses the container on open and cycles Tab/Shift+Tab within it while `active`.
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return
    const container = ref.current
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))

    const autoFocusEl = container.querySelector<HTMLElement>('[autofocus]')
    ;(autoFocusEl ?? focusables()[0] ?? container).focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [active, ref])
}
