import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Admin from './admin/Admin.tsx'
import { appPath } from './platform'

const isAdmin = window.location.pathname.replace(/\/+$/, '') === appPath('/irdmin')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </StrictMode>,
)
