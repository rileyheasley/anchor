import { useState, useEffect } from 'react'
import './App.css'

interface TestItem {
  id: number
  text: string
}

declare global {
  interface Window {
    api: {
      saveItem: (text: string) => Promise<number>
      getItems: () => Promise<TestItem[]>
    }
  }
}

function App() {
  const [input, setInput] = useState('')
  const [items, setItems] = useState<TestItem[]>([])

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    try {
      const result = await window.api.getItems()
      setItems(result)
    } catch (error) {
      console.error('Failed to load items:', error)
    }
  }

  const handleSave = async () => {
    if (!input.trim()) return
    try {
      await window.api.saveItem(input)
      setInput('')
      await loadItems()
    } catch (error) {
      console.error('Failed to save item:', error)
    }
  }

  return (
    <div>
      <h1>Anchor - SQLite Storage Test</h1>
      
      <div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Enter text..."
        />
        <button onClick={handleSave}>Save</button>
      </div>

      <h2>Saved Items</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.id}: {item.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
