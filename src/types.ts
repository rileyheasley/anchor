export type Priority = 'none' | 'low' | 'medium' | 'high'

export interface Project {
  id: string
  name: string
  priority: Priority
  due_date: string | null
  archived: number
  done_points: number
  total_points: number
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
  note_filename: string | null
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
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface RecycleItem {
  type: 'project' | 'card' | 'note'
  id: string
  title: string
  deleted_at: string
}

declare global {
  interface Window {
    api: {
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
        setTitleBarTheme: (dark: boolean) => Promise<void>
      }
      projects: {
        list: () => Promise<Project[]>
        create: (data: { name: string, priority?: Priority, due_date?: string | null }) => Promise<Project>
        update: (data: { id: string, name?: string, priority?: Priority, due_date?: string | null }) => Promise<Project>
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
        update: (data: { id: string, title?: string }) => Promise<Note>
        reorder: (data: { ids: string[] }) => Promise<void>
        getContent: (id: string) => Promise<string | null>
        saveContent: (id: string, content: string) => Promise<void>
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
    }
  }
}
