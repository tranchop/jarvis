import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/', rotulo: 'Início', icone: '◎', fim: true },
  { to: '/mestrado', rotulo: 'Painel', icone: '▦', fim: true },
  { to: '/mestrado/experimentos', rotulo: 'Experimentos', icone: '⚗' },
  { to: '/mestrado/protocolos', rotulo: 'Protocolos', icone: '☰' },
  { to: '/mestrado/tarefas', rotulo: 'Tarefas', icone: '✓' },
]

export default function Layout() {
  const { sair, session } = useAuth()
  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <img src="/jarvis/icon.svg" alt="" width={32} height={32} />
          <span>Jarvis</span>
        </div>
        <nav>
          <p className="grupo">Mestrado</p>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.fim} className="item-nav">
              <span aria-hidden>{n.icone}</span> {n.rotulo}
            </NavLink>
          ))}
          <p className="grupo">Em breve</p>
          <span className="item-nav inativo">Alunos de inglês</span>
          <span className="item-nav inativo">Escotismo</span>
          <span className="item-nav inativo">Pessoal</span>
        </nav>
        <div className="rodape-lateral">
          <span className="sutil pequeno">{session?.user.email}</span>
          <NavLink to="/conta" className="link pequeno">
            Conta e senha
          </NavLink>
          <button className="link" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </aside>
      <main className="conteudo">
        <Outlet />
      </main>
      <nav className="barra-inferior">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.fim} className="item-inferior">
            <span aria-hidden className="icone">
              {n.icone}
            </span>
            <span>{n.rotulo}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
