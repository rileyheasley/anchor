// Thin draggable title bar for window chrome.
// Provides the drag region and Mac traffic light clearance.

const isMac = navigator.platform.toLowerCase().includes('mac')

export default function TitleBar() {
  return (
    <div
      className="flex items-center h-10 bg-white border-b border-gray-200 select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Mac: leave space for traffic lights (approx 72px) */}
      {isMac && <div className="w-[72px] shrink-0" />}

      <span className="text-sm font-medium text-gray-400 tracking-wide px-3">Anchor</span>
    </div>
  )
}
