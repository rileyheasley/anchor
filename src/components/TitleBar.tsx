// Thin draggable title bar.
// On Mac: native traffic lights appear in the top-left; this bar provides the drag region.
// On Windows: the native overlay (titleBarOverlay) provides min/max/close on the right;
//   this bar provides the drag region and fills the left side.
// The bar is intentionally minimal — it's a foundation, not a finished design.

const isMac = navigator.platform.toLowerCase().includes('mac')
const isWin = navigator.platform.toLowerCase().includes('win')

export default function TitleBar() {
  return (
    <div
      className="flex items-center h-10 bg-white border-b border-gray-200 select-none shrink-0"
      // The entire bar is draggable except interactive children
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Mac: leave space for traffic lights (approx 72px) */}
      {isMac && <div className="w-[72px] shrink-0" />}

      <span className="text-sm font-medium text-gray-400 tracking-wide px-3">Anchor</span>

      {/* Windows: spacer so text doesn't collide with native overlay controls (~138px) */}
      {isWin && <div className="flex-1" />}
    </div>
  )
}
