import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './providers/ThemeProvider.jsx'
import { AuthProvider } from './providers/AuthProvider.jsx'
import { DetectorProvider } from './features/detector/DetectorContext.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

// Register service worker for PWA/offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed — app works fine without it
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <DetectorProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </DetectorProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
