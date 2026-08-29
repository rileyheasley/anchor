export interface Project {
  id: string
  name: string
  priority: string
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
  priority: string
  due_date: string | null
  position: number
  note_filename: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

declare global {
  interface Window {
    api: {
      projects: {
        list: () => Promise<Project[]>
        create: (data: { name: string }) => Promise<Project>
        update: (data: { id: string, name?: string, priority?: string, due_date?: string | null }) => Promise<Project>
        archive: (id: string) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      columns: {
        list: (projectId: string) => Promise<KanbanColumn[]>
        create: (data: { project_id: string, name: string }) => Promise<KanbanColumn>
        update: (data: { id: string, name?: string, is_done?: number }) => Promise<KanbanColumn>
        reorder: (data: { project_id: string, column_ids: string[] }) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      cards: {
        list: (projectId: string) => Promise<Card[]>
        create: (data: { project_id: string, column_id: string, title: string, points?: number, priority?: string, due_date?: string }) => Promise<Card>
        update: (data: { id: string, title?: string, points?: number | null, priority?: string, due_date?: string | null }) => Promise<Card>
        move: (data: { id: string, column_id: string, position: number }) => Promise<Card>
        reorder: (data: { column_id: string, card_ids: string[] }) => Promise<void>
        delete: (id: string) => Promise<void>
      }
    }
  }
}
