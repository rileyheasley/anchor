import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { errorSound, clickSound } from '../sounds'

interface Toast {
  id: number
  message: string
}

let nextId = 0

/**
 * Catches IPC calls (or any promise) that failed without a local .catch —
 * the app has 70+ scattered invoke() call sites and rewriting every one
 * isn't realistic before beta, so this is the net underneath all of them.
 */
export default function ErrorToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = reason instanceof Error ? reason.message : String(reason)
      console.error('[unhandledrejection]', reason)
      errorSound()
      const id = nextId++
      setToasts((prev) => [...prev, { id, message }])
      setTimeout(() => dismiss(id), 5000)
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="pointer-events-auto max-w-sm px-4 py-3 rounded-lg shadow-lg bg-danger-subtle border border-danger text-danger-strong text-sm flex items-start gap-2"
          >
            <div>
              <p className="font-medium">Something didn't go as planned.</p>
              <p className="text-xs opacity-80 mt-0.5">{toast.message}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { clickSound(); dismiss(toast.id) }}
              aria-label="Dismiss"
              className="ml-auto shrink-0 p-0.5 rounded cursor-pointer hover:bg-danger/20 transition-colors"
            >
              <X size={14} />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
