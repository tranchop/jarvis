import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STATUS_EXP, type Experimento, type StatusExperimento } from '../../lib/types'
import { codigoExp, formatarData, ok, useCarregar } from '../../lib/util'

type Filtro = StatusExperimento | 'ativos' | 'todos' | 'arquivados'

export default function Experimentos() {
  const [filtro, setFiltro] = useState<Filtro>('ativos')
  const [busca, setBusca] = useState('')
  const { dados, erro, carregando } = useCarregar(async () => {
    let q = supabase.from('experimentos').select('*').order('numero', { ascending: false })
    if (filtro === 'arquivados') q = q.eq('arquivado', true)
    else {
      q = q.eq('arquivado', false)
      if (filtro === 'ativos') q = q.in('status', ['planejado', 'em_andamento'])
      else if (filtro !== 'todos') q = q.eq('status', filtro)
    }
    return ok(await q) as Experimento[]
  }, [filtro])

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase()
    if (!dados || !b) return dados ?? []
    return dados.filter((e) =>
      [e.titulo, e.objetivo, e.modelo_celular, codigoExp(e.numero)].some((c) => c?.toLowerCase().includes(b)),
    )
  }, [dados, busca])

  return (
    <section>
      <header className="cabecalho">
        <h1>Experimentos</h1>
        <Link to="/mestrado/experimentos/novo" className="botao primario">
          + Novo
        </Link>
      </header>
      <div className="filtros">
        <input type="search" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
          <option value="ativos">Ativos</option>
          <option value="todos">Todos</option>
          {Object.entries(STATUS_EXP).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
          <option value="arquivados">Arquivados</option>
        </select>
      </div>
      {erro && <p className="erro">{erro}</p>}
      {carregando && !dados && <p className="sutil">Carregando…</p>}
      {dados && lista.length === 0 && <p className="sutil">Nenhum experimento aqui.</p>}
      <div className="grade-cartoes">
        {lista.map((e) => (
          <Link key={e.id} to={`/mestrado/experimentos/${e.id}`} className="cartao exp">
            <div className="linha-topo">
              <span className="codigo">{codigoExp(e.numero)}</span>
              <span className={`selo ${e.status}`}>{STATUS_EXP[e.status]}</span>
            </div>
            <h3>{e.titulo}</h3>
            <p className="sutil pequeno">
              {e.modelo_celular ?? 'Sem modelo'} · {formatarData(e.data_planejada)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
