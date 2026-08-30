export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
export const MOD_KEY = isMac ? '⌘' : 'Ctrl'

export interface ShortcutItem {
  keys: string[]
  description: string
}

export interface ShortcutGroup {
  title: string
  items: ShortcutItem[]
}

export function getShortcutGroups(): ShortcutGroup[] {
  return [
    {
      title: 'General',
      items: [
        { keys: [MOD_KEY, ','], description: 'Open settings' },
        { keys: [MOD_KEY, 'N'], description: 'Create new project or note (context-aware)' },
        { keys: ['Esc'], description: 'Close the active dialog, panel, or view' },
      ],
    },
    {
      title: 'Navigation',
      items: [
        { keys: [MOD_KEY, '1'], description: 'Go to Home' },
        { keys: [MOD_KEY, '2'], description: 'Go to Projects' },
        { keys: [MOD_KEY, '3'], description: 'Go to Notes' },
        { keys: [MOD_KEY, '4'], description: 'Go to Archive' },
        { keys: [MOD_KEY, '5'], description: 'Go to Recycle Bin' },
      ],
    },
    {
      title: 'Kanban board',
      items: [
        { keys: ['Esc'], description: 'Close the card editor panel' },
        { keys: ['Enter'], description: 'Confirm adding a new card or column' },
      ],
    },
    {
      title: 'Notes',
      items: [
        { keys: ['Enter'], description: 'Confirm creating a new note' },
        { keys: ['Esc'], description: 'Cancel new note / close note editor' },
      ],
    },
  ]
}
