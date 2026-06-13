import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode double-invokes effects/renders to surface bugs — invaluable in dev,
// but pure overhead in production. Gate it so shipped builds mount once.
const root = createRoot(document.getElementById('root')!)
root.render(
  import.meta.env.DEV ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  ),
)
