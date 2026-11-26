import { BriefcaseIcon, FlaskIcon, StudentIcon, TentIcon, UserCircleIcon, type Icon } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'

const AREAS: { nome: string; desc: string; to?: string; icone: Icon }[] = [
  { nome: 'Mestrado', desc: 'Experimentos, protocolos e tarefas', to: '/mestrado', icone: FlaskIcon },
  { nome: 'Alunos de inglês', desc: 'Aulas, horários e pagamentos', icone: StudentIcon },
  { nome: 'Escotismo', desc: 'Progressão dos jovens', icone: TentIcon },
  { nome: 'Pessoal', desc: 'Finanças, saúde e casa', icone: BriefcaseIcon },
]

export default function Inicio() {
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <h1>{saudacao}, Pedro</h1>
          <p className="sutil primeira-maiuscula">{hoje}</p>
        </div>
        <Link to="/conta" className="botao icone-btn so-mobile" aria-label="Conta e senha">
          <UserCircleIcon size={26} />
        </Link>
      </header>
      <div className="grade-areas">
        {AREAS.map((a) =>
          a.to ? (
            <Link key={a.nome} to={a.to} className="cartao cartao-link area">
              <a.icone size={28} className="icone-area" />
              <h2>{a.nome}</h2>
              <p className="sutil pequeno">{a.desc}</p>
            </Link>
          ) : (
            <div key={a.nome} className="cartao area inativo">
              <a.icone size={28} className="icone-area" />
              <h2>{a.nome}</h2>
              <p className="sutil pequeno">Em breve</p>
            </div>
          ),
        )}
      </div>
    </section>
  )
}
