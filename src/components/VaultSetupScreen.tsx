import { motion } from 'motion/react'
import { clickSound } from '../sounds'
import Logo from './Logo'

/**
 * Shown whenever no vault is open — first launch, or after the last vault
 * moved/was deleted. Picking a folder opens (or creates) that vault as the
 * whole active dataset, so a full reload is the simplest correct way to put
 * the rest of the app in front of it.
 */
export default function VaultSetupScreen() {
  const handleChoose = async () => {
    clickSound()
    const chosen = await window.api.vault.choose()
    if (chosen) window.location.reload()
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4 text-center px-8 bg-surface-sunken">
      <Logo width={40} height={43} className="shrink-0 text-ink-secondary" />
      <h1 className="font-heading text-2xl text-ink">Welcome to Anchor</h1>
      <p className="text-ink-muted text-sm max-w-sm">
        Anchor stores everything as plain files on your own disk — no account, no cloud. Choose a folder to use as
        your vault. An existing vault opens as-is; an empty folder starts a new one.
      </p>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleChoose}
        className="mt-2 px-6 py-3 bg-primary text-ink-inverse rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
      >
        Choose a folder
      </motion.button>
    </div>
  )
}
