import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const AREAS = [
  { nome: 'Mestrado', desc: 'Experimentos, protocolos e tarefas', to: '/mestrado', ativo: true },
  { nome: 'Alunos de inglês', desc: 'Aulas, horários e pagamentos', ativo: false },
  { nome: 'Escotismo', desc: 'Progressão dos jovens', ativo: false },
  { nome: 'Pessoal', desc: 'Finanças, saúde e casa', ativo: false },
]

export default function Inicio() {
  const { sair } = useAuth()
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  return (
    <section>
      <header className="cabecalho">
        <h1>{saudacao}, Pedro</h1>
        <button className="link so-mobile" onClick={() => void sair()}>
          Sair
        </button>
      </header>
      <div className="grade-areas">
        {AREAS.map((a) =>
          a.ativo && a.to ? (
            <Link key={a.nome} to={a.to} className="cartao area">
              <h2>{a.nome}</h2>
              <p className="sutil">{a.desc}</p>
            </Link>
          ) : (
            <div key={a.nome} className="cartao area inativo" aria-disabled>
              <h2>{a.nome}</h2>
              <p className="sutil">{a.desc}</p>
              <span className="etiqueta">Em breve</span>
            </div>
          ),
        )}
      </div>
    </section>
  )
}
