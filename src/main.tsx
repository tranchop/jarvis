import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Impede que o app seja aberto dentro de outro site (clickjacking)
if (window.top !== window.self) {
  document.body.innerHTML = ''
  throw new Error('Jarvis não pode ser aberto dentro de outra página.')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
