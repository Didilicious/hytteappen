import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <PwaUpdatePrompt />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
