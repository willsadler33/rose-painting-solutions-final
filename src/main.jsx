import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PreviewBanner from './components/PreviewBanner.jsx'
import { motionTier } from './lib/motion.js'
import { loadContent } from './content/load.js'

// Set the motion tier from static signals before first paint (refined by a frame probe later).
motionTier()

// The owner's published content (or the built-in content) is in place before the first render.
loadContent().then(({ preview, previewFailed }) => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
      {(preview || previewFailed) && <PreviewBanner failed={previewFailed} />}
    </StrictMode>,
  )
})
