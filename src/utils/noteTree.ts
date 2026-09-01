import type { Note, NoteFolder } from '../types'

export type NoteSortMode = 'manual' | 'newest' | 'oldest' | 'alpha'

export const SORT_MODE_LABELS: Record<NoteSortMode, string> = {
  manual: 'Manual',
  newest: 'Newest',
  oldest: 'Oldest',
  alpha: 'A–Z',
}

export const SORT_MODES: NoteSortMode[] = ['manual', 'newest', 'oldest', 'alpha']

export function sortByMode<T extends { position: number; created_at: string; updated_at: string }>(
  items: T[],
  mode: NoteSortMode,
  labelOf: (item: T) => string
): T[] {
  const sorted = [...items]
  if (mode === 'manual') sorted.sort((a, b) => a.position - b.position)
  else if (mode === 'newest') sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  else if (mode === 'oldest') sorted.sort((a, b) => a.updated_at.localeCompare(b.updated_at))
  else sorted.sort((a, b) => labelOf(a).localeCompare(labelOf(b), undefined, { sensitivity: 'base' }))
  return sorted
}

// Flattens the note tree into the same top-to-bottom order the sidebar renders in — folders
// (and their expanded contents) before this level's own notes — but skips folder rows
// themselves, since only notes participate in shift-click range selection.
export function flattenVisibleNotes(
  folders: NoteFolder[],
  notes: Note[],
  expandedIds: Set<string>,
  sortMode: NoteSortMode,
  parentId: string | null = null
): Note[] {
  const childFolders = sortByMode(
    folders.filter((f) => f.parent_folder_id === parentId),
    sortMode,
    (f) => f.name
  )
  const childNotes = sortByMode(
    notes.filter((n) => n.folder_id === parentId),
    sortMode,
    (n) => n.title
  )

  let result: Note[] = []
  for (const folder of childFolders) {
    if (expandedIds.has(folder.id)) {
      result = result.concat(flattenVisibleNotes(folders, notes, expandedIds, sortMode, folder.id))
    }
  }
  return result.concat(childNotes)
}

// True if `targetId` is `folderId` itself or a descendant of it — used to block dropping/moving
// a folder into itself or into one of its own subfolders (which would create a cycle).
export function isFolderOrDescendant(folders: NoteFolder[], folderId: string, targetId: string): boolean {
  let cursor: string | null = targetId
  while (cursor != null) {
    if (cursor === folderId) return true
    cursor = folders.find((f) => f.id === cursor)?.parent_folder_id ?? null
  }
  return false
}
