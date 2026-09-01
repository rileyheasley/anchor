import { useEffect, useRef, type RefObject } from 'react'

// Closes a popup/menu when a mousedown lands outside its container ref.
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, enabled: boolean = true) {
  const handlerRef = useRef(onOutside)
  handlerRef.current = onOutside

  useEffect(() => {
    if (!enabled) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handlerRef.current()
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [ref, enabled])
}
