import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (data: { name: string }) => ipcRenderer.invoke('projects:create', data),
    update: (data: { id: string, name?: string, priority?: string, due_date?: string | null }) => ipcRenderer.invoke('projects:update', data),
    archive: (id: string) => ipcRenderer.invoke('projects:archive', id),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
  },
  columns: {
    list: (projectId: string) => ipcRenderer.invoke('columns:list', projectId),
    create: (data: { project_id: string, name: string }) => ipcRenderer.invoke('columns:create', data),
    update: (data: { id: string, name?: string, is_done?: number }) => ipcRenderer.invoke('columns:update', data),
    reorder: (data: { project_id: string, column_ids: string[] }) => ipcRenderer.invoke('columns:reorder', data),
    delete: (id: string) => ipcRenderer.invoke('columns:delete', id),
  },
  cards: {
    list: (projectId: string) => ipcRenderer.invoke('cards:list', projectId),
    create: (data: { project_id: string, column_id: string, title: string, points?: number, priority?: string, due_date?: string }) => ipcRenderer.invoke('cards:create', data),
    update: (data: { id: string, title?: string, points?: number | null, priority?: string, due_date?: string | null }) => ipcRenderer.invoke('cards:update', data),
    move: (data: { id: string, column_id: string, position: number }) => ipcRenderer.invoke('cards:move', data),
    reorder: (data: { column_id: string, card_ids: string[] }) => ipcRenderer.invoke('cards:reorder', data),
    delete: (id: string) => ipcRenderer.invoke('cards:delete', id),
  },
})
