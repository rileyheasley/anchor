import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Store, Search, Sparkles, Download, Lock } from 'lucide-react'
import { clickSound } from '../sounds'

interface MarketplaceExtension {
  id: string
  name: string
  developer: string
  description: string
  icon: string
  category: string
  price: 'Free' | string
}

// Placeholder catalog — the marketplace has no backend yet. This lays out the UI
// so extension distribution can be wired in later without reshaping the page.
const PLACEHOLDER_EXTENSIONS: MarketplaceExtension[] = [
  { id: 'time-tracker', name: 'Time Tracker', developer: 'Anchor', description: 'Track time spent on cards and projects automatically.', icon: '⏱️', category: 'Productivity', price: 'Free' },
  { id: 'github-sync', name: 'GitHub Sync', developer: 'Anchor', description: 'Link cards to issues and pull requests.', icon: '🐙', category: 'Integrations', price: 'Free' },
  { id: 'ai-summaries', name: 'AI Summaries', developer: 'Anchor', description: 'Generate project and note summaries with AI.', icon: '✨', category: 'AI', price: '$4.99' },
  { id: 'calendar-view', name: 'Calendar View', developer: 'Anchor', description: 'See due dates and milestones on a calendar.', icon: '📅', category: 'Productivity', price: 'Free' },
  { id: 'midnight-theme', name: 'Midnight Theme Pack', developer: 'Anchor', description: 'A set of extra dark and colourblind-friendly themes.', icon: '🎨', category: 'Themes', price: '$1.99' },
  { id: 'slack-notify', name: 'Slack Notifications', developer: 'Anchor', description: 'Get notified in Slack when cards change status.', icon: '💬', category: 'Integrations', price: 'Free' },
]

const CATEGORIES = ['All', 'Productivity', 'Integrations', 'AI', 'Themes']

export default function MarketplacePage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const filtered = useMemo(() => {
    return PLACEHOLDER_EXTENSIONS.filter((ext) => {
      const matchesCategory = category === 'All' || ext.category === category
      const matchesSearch =
        search.trim().length === 0 ||
        ext.name.toLowerCase().includes(search.toLowerCase()) ||
        ext.description.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [search, category])

  return (
    <div className="h-full overflow-y-auto bg-surface-sunken">
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Store size={22} className="text-accent" />
          <h1 className="font-heading text-xl font-semibold text-ink">Marketplace</h1>
        </div>
        <p className="text-sm text-ink-faint mb-6">Extend Anchor with new features and integrations.</p>

        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border border-border bg-accent-subtle text-accent-strong text-xs">
          <Sparkles size={14} className="shrink-0" />
          <span>The marketplace is coming soon. Here&apos;s a preview of what&apos;s planned — nothing is installable yet.</span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search extensions..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {CATEGORIES.map((c) => (
            <motion.button
              key={c}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { clickSound(); setCategory(c) }}
              className={`text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                category === c
                  ? 'bg-primary text-ink-inverse font-medium'
                  : 'bg-surface-muted text-ink-muted hover:bg-border-strong'
              }`}
            >
              {c}
            </motion.button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-24 text-ink-faint">
            <p className="text-base font-medium text-ink-muted">No extensions match your search</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((ext) => (
            <div
              key={ext.id}
              className="bg-surface rounded-lg border border-border p-4 flex flex-col"
            >
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl leading-none">{ext.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-medium text-ink text-sm">{ext.name}</h3>
                  <p className="text-xs text-ink-faint">{ext.developer}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                    ext.price === 'Free'
                      ? 'bg-accent-subtle text-accent-strong'
                      : 'bg-surface-muted text-ink-muted'
                  }`}
                >
                  {ext.price}
                </span>
              </div>
              <p className="text-xs text-ink-muted mb-3 flex-1">{ext.description}</p>
              <button
                disabled
                title="Coming soon"
                className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-muted text-ink-faint cursor-not-allowed font-medium"
              >
                <Lock size={12} />
                Coming soon
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-ink-faint flex items-center justify-center gap-1.5">
          <Download size={12} />
          Installed extensions will appear here once the marketplace launches.
        </div>
      </main>
    </div>
  )
}
