import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Esqueleto, Vazio } from '../../components/Estados'
import { supabase } from '../../lib/supabase'
import { STATUS_EXP, type Experimento } from '../../lib/types'
import { codigoExp, dataRelativa, ok, useCarregar } from '../../lib/util'

const FILTROS = [
  { v: 'ativos', r: 'Ativos' },
  { v: 'concluido', r: 'Concluídos' },
  { v: 'todos', r: 'Todos' },
  { v: 'arquivados', r: 'Arquivados' },
] as const
type Filtro = (typeof FILTROS)[number]['v']

export default function Experimentos() {
  const [filtro, setFiltro] = useState<Filtro>('ativos')
  const [busca, setBusca] = useState('')
  const { dados, erro } = useCarregar(async () => {
    let q = supabase.from('experimentos').select('*').order('numero', { ascending: false })
    if (filtro === 'arquivados') q = q.eq('arquivado', true)
    else {
      q = q.eq('arquivado', false)
      if (filtro === 'ativos') q = q.in('status', ['planejado', 'em_andamento'])
      else if (filtro === 'concluido') q = q.in('status', ['concluido', 'cancelado'])
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
        <div className="titulos">
          <h1>Experimentos</h1>
        </div>
        <Link to="/mestrado/experimentos/novo" className="botao primario">
          <PlusIcon size={18} weight="bold" /> Novo
        </Link>
      </header>
      <div className="filtros">
        <div className="busca">
          <MagnifyingGlassIcon size={18} />
          <input
            type="search"
            aria-label="Buscar experimentos"
            placeholder="Buscar por título, modelo ou EXP"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="segmentos" role="group" aria-label="Filtrar">
          {FILTROS.map((f) => (
            <button key={f.v} aria-pressed={filtro === f.v} onClick={() => setFiltro(f.v)}>
              {f.r}
            </button>
          ))}
        </div>
      </div>
      {erro && <p className="erro">{erro}</p>}
      {!dados && !erro && <Esqueleto linhas={3} />}
      {dados && lista.length === 0 && (
        <div className="cartao">
          {busca ? (
            <Vazio>Nada encontrado para "{busca}".</Vazio>
          ) : (
            <Vazio
              acao={
                filtro === 'ativos' && (
                  <Link to="/mestrado/experimentos/novo" className="botao pequeno">
                    <PlusIcon size={16} /> Planejar experimento
                  </Link>
                )
              }
            >
              {filtro === 'ativos' ? 'Nenhum experimento planejado ou em andamento.' : 'Nenhum experimento neste filtro.'}
            </Vazio>
          )}
        </div>
      )}
      <div className="grade-cartoes">
        {lista.map((e) => (
          <Link key={e.id} to={`/mestrado/experimentos/${e.id}`} className="cartao cartao-link">
            <div className="topo">
              <span className="codigo">{codigoExp(e.numero)}</span>
              <span className={`selo ${e.status}`}>{STATUS_EXP[e.status]}</span>
            </div>
            <h3>{e.titulo}</h3>
            <p className="sutil pequeno">
              {[e.modelo_celular, dataRelativa(e.data_execucao ?? e.data_planejada, 'Sem data')].filter(Boolean).join(', ')}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
