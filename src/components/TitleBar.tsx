// Thin draggable title bar for window chrome.
// Provides the drag region and Mac traffic light clearance.
import logo from '../assets/logos/logo.svg'

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
        {/* Masked so the logo's fill tracks the theme's ink color instead of a fixed SVG color */}
        <span
          aria-hidden
          className="shrink-0 bg-ink-secondary"
          style={{
            width: 15,
            height: 16,
            WebkitMaskImage: `url(${logo})`,
            maskImage: `url(${logo})`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
          }}
        />
        <span className="text-sm font-bold text-ink-secondary tracking-tight">Anchor</span>
      </div>
    </div>
  )
}
