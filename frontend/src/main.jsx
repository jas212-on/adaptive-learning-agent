import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './providers/ThemeProvider.jsx'
import { AuthProvider } from './providers/AuthProvider.jsx'
import { DetectorProvider } from './features/detector/DetectorContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <DetectorProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </DetectorProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
