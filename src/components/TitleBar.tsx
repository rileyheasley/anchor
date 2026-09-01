// Thin draggable title bar for window chrome.
// Provides the drag region and Mac traffic light clearance.
import Logo from './Logo'

const isMac = navigator.platform.toLowerCase().includes('mac')

export default function TitleBar() {
  return (
    <div
      className="flex items-center h-10 bg-surface border-b border-border select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Mac: leave space for traffic lights (approx 72px) */}
      {isMac && <div className="w-[72px] shrink-0" />}

      <div className="flex items-center gap-1.5 px-3">
        <Logo width={15} height={16} className="shrink-0 text-ink-secondary" />
        <span className="font-heading text-sm font-bold text-ink-secondary tracking-tight">Anchor</span>
      </div>
    </div>
  )
}
