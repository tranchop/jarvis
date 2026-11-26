import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './lib/auth'
import { configurado } from './lib/supabase'
import Conta from './pages/Conta'
import DoisFatores from './pages/DoisFatores'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import ExperimentoDetalhe from './pages/mestrado/ExperimentoDetalhe'
import Experimentos from './pages/mestrado/Experimentos'
import Painel from './pages/mestrado/Painel'
import ProtocoloDetalhe from './pages/mestrado/ProtocoloDetalhe'
import Protocolos from './pages/mestrado/Protocolos'
import Tarefas from './pages/mestrado/Tarefas'

function Portao() {
  const { nivel } = useAuth()
  if (nivel === 'carregando') return <main className="tela-auth sutil">Carregando…</main>
  if (nivel === 'deslogado') return <Login />
  if (nivel === 'precisa_2fa') return <DoisFatores />
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="mestrado" element={<Painel />} />
          <Route path="mestrado/experimentos" element={<Experimentos />} />
          <Route path="mestrado/experimentos/:id" element={<ExperimentoDetalhe />} />
          <Route path="mestrado/protocolos" element={<Protocolos />} />
          <Route path="mestrado/protocolos/:id" element={<ProtocoloDetalhe />} />
          <Route path="mestrado/tarefas" element={<Tarefas />} />
          <Route path="conta" element={<Conta />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  if (!configurado)
    return (
      <main className="tela-auth">
        <div className="cartao auth">
          <h1>Jarvis</h1>
          <p className="erro">Configuração do Supabase ausente.</p>
        </div>
      </main>
    )
  return (
    <AuthProvider>
      <Portao />
    </AuthProvider>
  )
}
