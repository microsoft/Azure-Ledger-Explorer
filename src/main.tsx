//import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

// strict mode is disabled due to bugs in FluentUI 9 running on React 18+
createRoot(document.getElementById('root')!).render(
    <App />
)
