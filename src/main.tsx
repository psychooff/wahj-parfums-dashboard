import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

const container = document.getElementById('root')!

function reportFatal(err: unknown) {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  console.error('[WAHJ] failed to start:', err)
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,sans-serif;color:#D9C9A3">
      <div style="max-width:560px;border:1px solid rgba(248,113,113,.3);background:rgba(248,113,113,.07);border-radius:16px;padding:18px">
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:18px;margin-bottom:6px">WAHJ PARFUMS — startup error</div>
        <div style="font-size:12.5px;line-height:1.6;opacity:.85">The dashboard could not start in this browser context. The details below are safe to share.</div>
        <pre style="margin-top:12px;max-height:220px;overflow:auto;font-size:11px;line-height:1.6;color:#F0A3A3;white-space:pre-wrap">${message.replace(
          /[<>&]/g,
          (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!,
        )}</pre>
      </div>
    </div>`
}

try {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
} catch (err) {
  reportFatal(err)
}
