import {
  BarbellIcon,
  BookOpenTextIcon,
  BriefcaseIcon,
  CheckSquareIcon,
  FlaskIcon,
  HeartbeatIcon,
  HouseIcon,
  HouseLineIcon,
  SignOutIcon,
  SquaresFourIcon,
  UserCircleIcon,
  WalletIcon,
  type Icon,
} from '@phosphor-icons/react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

interface ItemNav {
  to: string
  rotulo: string
  icone: Icon
  fim?: boolean
}

const INICIO: ItemNav = { to: '/', rotulo: 'Início', icone: HouseIcon, fim: true }
const MESTRADO: ItemNav[] = [
  { to: '/mestrado', rotulo: 'Painel', icone: SquaresFourIcon, fim: true },
  { to: '/mestrado/experimentos', rotulo: 'Experimentos', icone: FlaskIcon },
  { to: '/mestrado/protocolos', rotulo: 'Protocolos', icone: BookOpenTextIcon },
  { to: '/mestrado/tarefas', rotulo: 'Tarefas', icone: CheckSquareIcon },
]
const PESSOAL: ItemNav[] = [
  { to: '/pessoal', rotulo: 'Resumo', icone: SquaresFourIcon, fim: true },
  { to: '/pessoal/financas', rotulo: 'Finanças', icone: WalletIcon },
  { to: '/pessoal/saude', rotulo: 'Saúde', icone: HeartbeatIcon },
  { to: '/pessoal/treinos', rotulo: 'Treinos', icone: BarbellIcon },
  { to: '/pessoal/casa', rotulo: 'Casa', icone: HouseLineIcon },
]

// No celular, a barra inferior mostra as seções da área atual
function itensInferiores(caminho: string): ItemNav[] {
  if (caminho.startsWith('/pessoal')) return [INICIO, ...PESSOAL.slice(1)]
  if (caminho.startsWith('/mestrado')) return [INICIO, ...MESTRADO]
  return [
    INICIO,
    { to: '/mestrado', rotulo: 'Mestrado', icone: FlaskIcon },
    { to: '/pessoal', rotulo: 'Pessoal', icone: BriefcaseIcon },
    { to: '/conta', rotulo: 'Conta', icone: UserCircleIcon },
  ]
}

export default function Layout() {
  const { sair, session } = useAuth()
  const { pathname } = useLocation()
  const inferiores = itensInferiores(pathname)
  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <img src="/jarvis/icon.svg" alt="" width={30} height={30} />
          <span>Jarvis</span>
        </div>
        <nav aria-label="Principal">
          <ItemLateral item={INICIO} />
          <p className="grupo">Mestrado</p>
          {MESTRADO.map((n) => (
            <ItemLateral key={n.to} item={n} />
          ))}
          <p className="grupo">Pessoal</p>
          {PESSOAL.map((n) => (
            <ItemLateral key={n.to} item={n} />
          ))}
          <p className="grupo">Em breve</p>
          <p className="em-breve">Alunos de inglês e Escotismo</p>
        </nav>
        <div className="rodape-lateral">
          <span className="email">{session?.user.email}</span>
          <ItemLateral item={{ to: '/conta', rotulo: 'Conta e senha', icone: UserCircleIcon }} />
          <button className="item-nav sair-btn" onClick={() => void sair()}>
            <SignOutIcon size={20} /> Sair
          </button>
        </div>
      </aside>
      <main className="conteudo">
        <Outlet />
      </main>
      <nav className="barra-inferior" aria-label="Principal" style={{ gridTemplateColumns: `repeat(${inferiores.length}, 1fr)` }}>
        {inferiores.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.fim} className="item-inferior">
            {({ isActive }) => (
              <>
                <n.icone size={24} weight={isActive ? 'fill' : 'regular'} />
                <span>{n.rotulo}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function ItemLateral({ item }: { item: ItemNav }) {
  return (
    <NavLink to={item.to} end={item.fim} className="item-nav">
      {({ isActive }) => (
        <>
          <item.icone size={20} weight={isActive ? 'fill' : 'regular'} />
          {item.rotulo}
        </>
      )}
    </NavLink>
  )
}
