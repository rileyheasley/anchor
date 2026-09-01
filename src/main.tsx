import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import ErrorToasts from './components/ErrorToasts.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary recovery="reload-app" message="The app hit an unexpected error. Your data is safe — it lives on disk, not in memory.">
      <App />
      <ErrorToasts />
    </ErrorBoundary>
  </React.StrictMode>,
)
