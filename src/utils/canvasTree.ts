import type { Canvas, CanvasFolder } from '../types'
import { sortByMode, type NoteSortMode } from './noteTree'

export type CanvasSortMode = NoteSortMode

export { sortByMode, SORT_MODE_LABELS, SORT_MODES } from './noteTree'

// Flattens the canvas tree into the same top-to-bottom order the sidebar renders in — folders
// (and their expanded contents) before this level's own canvases — but skips folder rows
// themselves, since only canvases participate in shift-click range selection.
export function flattenVisibleCanvases(
  folders: CanvasFolder[],
  canvases: Canvas[],
  expandedIds: Set<string>,
  sortMode: CanvasSortMode,
  parentId: string | null = null
): Canvas[] {
  const childFolders = sortByMode(
    folders.filter((f) => f.parent_folder_id === parentId),
    sortMode,
    (f) => f.name
  )
  const childCanvases = sortByMode(
    canvases.filter((c) => c.folder_id === parentId),
    sortMode,
    (c) => c.title
  )

  let result: Canvas[] = []
  for (const folder of childFolders) {
    if (expandedIds.has(folder.id)) {
      result = result.concat(flattenVisibleCanvases(folders, canvases, expandedIds, sortMode, folder.id))
    }
  }
  return result.concat(childCanvases)
}

// True if `targetId` is `folderId` itself or a descendant of it — used to block dropping/moving
// a folder into itself or into one of its own subfolders (which would create a cycle).
export function isCanvasFolderOrDescendant(folders: CanvasFolder[], folderId: string, targetId: string): boolean {
  let cursor: string | null = targetId
  while (cursor != null) {
    if (cursor === folderId) return true
    cursor = folders.find((f) => f.id === cursor)?.parent_folder_id ?? null
  }
  return false
}
