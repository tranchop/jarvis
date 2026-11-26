import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Protocolo } from '../../lib/types'
import { formatarData, ok, useCarregar } from '../../lib/util'

export default function Protocolos() {
  const [arquivados, setArquivados] = useState(false)
  const [busca, setBusca] = useState('')
  const { dados, erro, carregando } = useCarregar(
    async () =>
      ok(
        await supabase
          .from('protocolos')
          .select('id, titulo, categoria, versao, arquivado, updated_at')
          .eq('arquivado', arquivados)
          .order('titulo'),
      ) as Omit<Protocolo, 'conteudo'>[],
    [arquivados],
  )

  const grupos = useMemo(() => {
    const b = busca.trim().toLowerCase()
    const lista = (dados ?? []).filter(
      (p) => !b || p.titulo.toLowerCase().includes(b) || p.categoria?.toLowerCase().includes(b),
    )
    const m = new Map<string, typeof lista>()
    for (const p of lista) {
      const c = p.categoria || 'Sem categoria'
      m.set(c, [...(m.get(c) ?? []), p])
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [dados, busca])

  return (
    <section>
      <header className="cabecalho">
        <h1>Protocolos</h1>
        <Link to="/mestrado/protocolos/novo" className="botao primario">
          + Novo
        </Link>
      </header>
      <div className="filtros">
        <input type="search" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="check">
          <input type="checkbox" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} /> Arquivados
        </label>
      </div>
      {erro && <p className="erro">{erro}</p>}
      {carregando && !dados && <p className="sutil">Carregando…</p>}
      {dados && grupos.length === 0 && <p className="sutil">Nenhum protocolo ainda.</p>}
      {grupos.map(([cat, itens]) => (
        <div key={cat} className="cartao">
          <h2>{cat}</h2>
          <ul className="lista">
            {itens.map((p) => (
              <li key={p.id}>
                <Link to={`/mestrado/protocolos/${p.id}`} className="linha-lista">
                  <span className="cresce">{p.titulo}</span>
                  <span className="sutil pequeno">
                    v{p.versao} · {formatarData(p.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
