import { Sun, Moon, Heart, Monitor, Snowflake, Ghost, Terminal, BookOpen, Leaf, Waves, Contrast, Eye } from 'lucide-react'
import type { ResolvedTheme, ThemeMode } from '../types'

// Themes whose surface colour is dark. Used to tell native browser/OS controls
// (e.g. the <input type="date"> calendar glyph) to render in their light-on-dark
// variant via `color-scheme`, since that isn't covered by our CSS colour tokens.
const DARK_SURFACE_THEMES: ReadonlySet<ResolvedTheme> = new Set([
  'dark', 'nord', 'dracula', 'solarized', 'ocean', 'deuteranopia', 'protanopia', 'tritanopia',
])

export function isDarkSurfaceTheme(theme: string | null): boolean {
  return theme !== null && DARK_SURFACE_THEMES.has(theme as ResolvedTheme)
}

export function getNativeColorScheme(theme: string | null = document.documentElement.getAttribute('data-theme')): 'light' | 'dark' {
  return isDarkSurfaceTheme(theme) ? 'dark' : 'light'
}

export const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'pink', label: 'Folklore', icon: Heart },
  { mode: 'nord', label: 'Nord', icon: Snowflake },
  { mode: 'dracula', label: 'Dracula', icon: Ghost },
  { mode: 'solarized', label: 'Solarized', icon: Terminal },
  { mode: 'sepia', label: 'Sepia', icon: BookOpen },
  { mode: 'forest', label: 'Forest', icon: Leaf },
  { mode: 'ocean', label: 'Ocean', icon: Waves },
  { mode: 'contrast', label: 'High Contrast', icon: Contrast },
  { mode: 'system', label: 'System', icon: Monitor },
]

// Colourblind-friendly variants of Dark mode, shown in their own submenu/section.
export const COLOURBLIND_THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'deuteranopia', label: 'Deuteranopia', icon: Eye },
  { mode: 'protanopia', label: 'Protanopia', icon: Eye },
  { mode: 'tritanopia', label: 'Tritanopia', icon: Eye },
]

// Full set, for icon lookup and persisted-value validation.
export const ALL_THEME_OPTIONS = [...THEME_OPTIONS, ...COLOURBLIND_THEME_OPTIONS]
