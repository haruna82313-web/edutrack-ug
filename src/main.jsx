import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext'

registerSW({
  immediate: true,
  onNeedRefresh() {
    if (confirm('A new version of EduTrack is ready. Reload now?')) {
      window.location.reload()
    }
  },
  onOfflineReady() {
    console.info('EduTrack is ready to work offline.')
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
