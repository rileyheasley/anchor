export type Priority = 'none' | 'low' | 'medium' | 'high'
export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'done'
export type ResolvedTheme = 'light' | 'dark' | 'pink' | 'nord' | 'dracula' | 'solarized' | 'sepia' | 'forest' | 'ocean' | 'contrast' | 'deuteranopia' | 'protanopia' | 'tritanopia'
export type ThemeMode = ResolvedTheme | 'system'

export interface Project {
  id: string
  name: string
  priority: Priority
  status: ProjectStatus
  due_date: string | null
  archived: number
  done_points: number
  total_points: number
  total_cards: number
  done_cards: number
  created_at: string
  updated_at: string
}

export interface KanbanColumn {
  id: string
  project_id: string
  name: string
  position: number
  is_done: number
  created_at: string
  updated_at: string
}

export interface Card {
  id: string
  project_id: string
  column_id: string
  title: string
  points: number | null
  priority: Priority
  due_date: string | null
  position: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  title: string
  filename: string
  project_id: string | null
  card_id: string | null
  linked_project_id: string | null
  folder_id: string | null
  position: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface NoteFolder {
  id: string
  name: string
  parent_folder_id: string | null
  position: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Canvas {
  id: string
  title: string
  filename: string
  project_id: string | null
  linked_project_id: string | null
  folder_id: string | null
  position: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface CanvasFolder {
  id: string
  name: string
  parent_folder_id: string | null
  position: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Todo {
  id: string
  text: string
  priority: Priority
  due_date: string | null
  done: number
  position: number
  created_at: string
  updated_at: string
}

export interface RecycleItem {
  type: 'project' | 'card' | 'note' | 'canvas'
  id: string
  title: string
  deleted_at: string
}

export interface SearchProjectResult {
  id: string
  name: string
  priority: Priority
  status: ProjectStatus
}

export interface SearchCardResult {
  id: string
  title: string
  project_id: string
  project_name: string
}

export interface SearchNoteResult {
  id: string
  title: string
  project_id: string | null
  card_id: string | null
  resolved_project_id: string | null
  project_name: string | null
}

export interface SearchCanvasResult {
  id: string
  title: string
  project_id: string | null
  resolved_project_id: string | null
  project_name: string | null
}

export interface SearchResults {
  projects: SearchProjectResult[]
  cards: SearchCardResult[]
  notes: SearchNoteResult[]
  canvases: SearchCanvasResult[]
}

export interface OverviewDueCard {
  id: string
  title: string
  project_id: string
  project_name: string
  due_date: string
  priority: Priority
}

export interface OverviewStaleProject {
  id: string
  name: string
  priority: Priority
  status: ProjectStatus
  last_activity: string
}

export interface OverviewRecentNote {
  id: string
  title: string
  project_id: string | null
  card_id: string | null
  resolved_project_id: string | null
  project_name: string | null
  updated_at: string
}

export interface OverviewData {
  dueCards: OverviewDueCard[]
  staleProjects: OverviewStaleProject[]
  statusRows: { status: ProjectStatus, count: number }[]
  pointsTrend: { this_week: number, last_week: number }
  recentNotes: OverviewRecentNote[]
}

declare global {
  interface Window {
    api: {
      app: {
        getVersion: () => Promise<string>
        openLogFolder: () => Promise<void>
      }
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
        setTitleBarTheme: (theme: ResolvedTheme) => Promise<void>
      }
      projects: {
        list: () => Promise<Project[]>
        create: (data: { name: string, priority?: Priority, status?: ProjectStatus, due_date?: string | null }) => Promise<Project>
        update: (data: { id: string, name?: string, priority?: Priority, status?: ProjectStatus, due_date?: string | null }) => Promise<Project>
        archive: (id: string) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      columns: {
        list: (projectId: string) => Promise<KanbanColumn[]>
        create: (data: { project_id: string, name: string, is_done?: number }) => Promise<KanbanColumn>
        update: (data: { id: string, name?: string, is_done?: number }) => Promise<KanbanColumn>
        reorder: (data: { project_id: string, column_ids: string[] }) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      cards: {
        list: (projectId: string) => Promise<Card[]>
        create: (data: { project_id: string, column_id: string, title: string, points?: number, priority?: Priority, due_date?: string }) => Promise<Card>
        update: (data: { id: string, title?: string, points?: number | null, priority?: Priority, due_date?: string | null }) => Promise<Card>
        move: (data: { id: string, column_id: string, position: number }) => Promise<Card>
        reorder: (data: { column_id: string, card_ids: string[] }) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      settings: {
        get: (key: string) => Promise<string | null>
        set: (key: string, value: string) => Promise<void>
      }
      vault: {
        getPath: () => Promise<string | null>
        choose: () => Promise<string | null>
      }
      notes: {
        list: (filter?: { project_id?: string, card_id?: string, standalone?: boolean }) => Promise<Note[]>
        create: (data: { title: string, project_id?: string, card_id?: string }) => Promise<Note>
        update: (data: { id: string, title?: string, project_id?: string | null }) => Promise<Note>
        link: (data: { id: string, project_id: string }) => Promise<Note>
        unlink: (id: string) => Promise<Note>
        reorder: (data: { ids: string[] }) => Promise<void>
        move: (data: { ids: string[], folder_id: string | null }) => Promise<void>
        getContent: (id: string) => Promise<string | null>
        previewsForProject: (projectId: string) => Promise<Record<string, string>>
        saveContent: (id: string, content: string) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      folders: {
        list: () => Promise<NoteFolder[]>
        create: (data: { name: string, parent_folder_id?: string | null }) => Promise<NoteFolder>
        rename: (data: { id: string, name: string }) => Promise<NoteFolder>
        move: (data: { id: string, parent_folder_id: string | null }) => Promise<NoteFolder>
        reorder: (data: { ids: string[] }) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      canvases: {
        list: (filter?: { project_id?: string, standalone?: boolean }) => Promise<Canvas[]>
        create: (data: { title?: string, project_id?: string }) => Promise<Canvas>
        update: (data: { id: string, title?: string, project_id?: string | null }) => Promise<Canvas>
        link: (data: { id: string, project_id: string }) => Promise<Canvas>
        unlink: (id: string) => Promise<Canvas>
        reorder: (data: { ids: string[] }) => Promise<void>
        move: (data: { ids: string[], folder_id: string | null }) => Promise<void>
        getContent: (id: string) => Promise<string | null>
        saveContent: (id: string, content: string) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      canvasFolders: {
        list: () => Promise<CanvasFolder[]>
        create: (data: { name: string, parent_folder_id?: string | null }) => Promise<CanvasFolder>
        rename: (data: { id: string, name: string }) => Promise<CanvasFolder>
        move: (data: { id: string, parent_folder_id: string | null }) => Promise<CanvasFolder>
        reorder: (data: { ids: string[] }) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      recycle: {
        list: () => Promise<RecycleItem[]>
        restore: (type: string, id: string) => Promise<void>
        purge: (type: string, id: string) => Promise<void>
      }
      archive: {
        list: () => Promise<Project[]>
        restore: (id: string) => Promise<void>
      }
      search: {
        query: (query: string) => Promise<SearchResults>
      }
      overview: {
        get: () => Promise<OverviewData>
      }
      todos: {
        list: () => Promise<Todo[]>
        create: (data: { text: string }) => Promise<Todo>
        update: (data: { id: string, text?: string, priority?: Priority, due_date?: string | null }) => Promise<Todo>
        toggle: (id: string) => Promise<Todo>
        reorder: (data: { ids: string[] }) => Promise<void>
        delete: (id: string) => Promise<void>
      }
    }
  }
}
