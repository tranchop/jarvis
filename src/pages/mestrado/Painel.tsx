import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STATUS_EXP, type Experimento, type Tarefa } from '../../lib/types'
import { codigoExp, formatarData, hojeISO, ok, useCarregar } from '../../lib/util'

export default function Painel() {
  const { dados, erro, carregando } = useCarregar(async () => {
    const [exps, tarefas] = await Promise.all([
      supabase
        .from('experimentos')
        .select('*')
        .eq('arquivado', false)
        .in('status', ['planejado', 'em_andamento'])
        .order('data_planejada', { ascending: true, nullsFirst: false })
        .limit(8),
      supabase
        .from('tarefas')
        .select('*')
        .eq('area', 'mestrado')
        .eq('status', 'pendente')
        .eq('arquivado', false)
        .order('prazo', { ascending: true, nullsFirst: false })
        .limit(8),
    ])
    return { exps: ok(exps) as Experimento[], tarefas: ok(tarefas) as Tarefa[] }
  }, [])

  const hoje = hojeISO()
  return (
    <section>
      <header className="cabecalho">
        <h1>Mestrado</h1>
        <Link to="/mestrado/experimentos/novo" className="botao primario">
          + Experimento
        </Link>
      </header>
      {erro && <p className="erro">{erro}</p>}
      {carregando && !dados && <p className="sutil">Carregando…</p>}
      {dados && (
        <div className="colunas">
          <div className="cartao">
            <h2>Experimentos ativos</h2>
            {dados.exps.length === 0 && <p className="sutil">Nenhum experimento planejado.</p>}
            <ul className="lista">
              {dados.exps.map((e) => (
                <li key={e.id}>
                  <Link to={`/mestrado/experimentos/${e.id}`} className="linha-lista">
                    <span className="codigo">{codigoExp(e.numero)}</span>
                    <span className="cresce">{e.titulo}</span>
                    <span className={`selo ${e.status}`}>{STATUS_EXP[e.status]}</span>
                    <span className="sutil pequeno">{formatarData(e.data_planejada)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="cartao">
            <h2>Próximas tarefas</h2>
            {dados.tarefas.length === 0 && <p className="sutil">Nada pendente.</p>}
            <ul className="lista">
              {dados.tarefas.map((t) => (
                <li key={t.id} className="linha-lista">
                  <span className={`prioridade p${t.prioridade}`} aria-label={`prioridade ${t.prioridade}`} />
                  <span className="cresce">{t.titulo}</span>
                  <span className={`pequeno ${t.prazo && t.prazo < hoje ? 'atrasada' : 'sutil'}`}>
                    {formatarData(t.prazo)}
                  </span>
                </li>
              ))}
            </ul>
            <Link to="/mestrado/tarefas" className="link">
              Ver todas →
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
