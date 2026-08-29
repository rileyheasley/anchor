import { useState, useEffect } from 'react'
import './App.css'

interface Project {
  id: string
  name: string
  priority: string
  due_date: string | null
  done_points: number
  total_points: number
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
    }
  }
}

function App() {
  const [input, setInput] = useState('')
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const result = await window.api.projects.list()
      setProjects(result)
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const handleCreate = async () => {
    if (!input.trim()) return
    try {
      await window.api.projects.create({ name: input })
      setInput('')
      await loadProjects()
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  const handlePriority = async (id: string, priority: string) => {
    try {
      await window.api.projects.update({ id, priority })
      await loadProjects()
    } catch (error) {
      console.error('Failed to update priority:', error)
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await window.api.projects.archive(id)
      await loadProjects()
    } catch (error) {
      console.error('Failed to archive project:', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await window.api.projects.delete(id)
      await loadProjects()
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const priorityColors: Record<string, string> = {
    none: '#888',
    low: '#4a9eff',
    medium: '#f0ad4e',
    high: '#d9534f',
  }

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ marginBottom: 24 }}>Anchor — Test UI</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="New project name..."
          style={{ flex: 1, padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button onClick={handleCreate} style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}>
          Create
        </button>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Projects ({projects.length})</h2>

      {projects.length === 0 && <p style={{ color: '#888' }}>No projects yet — create one above.</p>}

      {projects.map((p) => (
        <div key={p.id} style={{
          border: '1px solid #ddd', borderRadius: 6, padding: 16, marginBottom: 12,
          borderLeft: `4px solid ${priorityColors[p.priority] || '#888'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 16 }}>{p.name}</strong>
            <span style={{ fontSize: 12, color: '#888' }}>{p.id.slice(0, 8)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Priority:</span>
            {['none', 'low', 'medium', 'high'].map((pri) => (
              <button
                key={pri}
                onClick={() => handlePriority(p.id, pri)}
                style={{
                  padding: '2px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 3,
                  border: p.priority === pri ? `2px solid ${priorityColors[pri]}` : '1px solid #ccc',
                  background: p.priority === pri ? priorityColors[pri] + '22' : 'transparent',
                  fontWeight: p.priority === pri ? 600 : 400,
                }}
              >
                {pri}
              </button>
            ))}
          </div>

          {p.total_points > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                Progress: {p.done_points}/{p.total_points} pts
              </div>
              <div style={{ background: '#eee', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{
                  background: '#4a9eff', height: '100%', borderRadius: 4,
                  width: `${(p.done_points / p.total_points) * 100}%`, transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => handleArchive(p.id)} style={{ fontSize: 12, cursor: 'pointer' }}>Archive</button>
            <button onClick={() => handleDelete(p.id)} style={{ fontSize: 12, cursor: 'pointer', color: '#d9534f' }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default App
