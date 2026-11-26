import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Esqueleto, Vazio } from '../../components/Estados'
import { supabase } from '../../lib/supabase'
import type { Protocolo } from '../../lib/types'
import { atualizadoEm, ok, useCarregar } from '../../lib/util'

export default function Protocolos() {
  const [arquivados, setArquivados] = useState(false)
  const [busca, setBusca] = useState('')
  const { dados, erro } = useCarregar(
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
    const lista = (dados ?? []).filter((p) => !b || p.titulo.toLowerCase().includes(b) || p.categoria?.toLowerCase().includes(b))
    const m = new Map<string, typeof lista>()
    for (const p of lista) {
      const c = p.categoria || 'Sem categoria'
      m.set(c, [...(m.get(c) ?? []), p])
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
  }, [dados, busca])

  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <h1>Protocolos</h1>
        </div>
        <Link to="/mestrado/protocolos/novo" className="botao primario">
          <PlusIcon size={18} weight="bold" /> Novo
        </Link>
      </header>
      <div className="filtros">
        <div className="busca">
          <MagnifyingGlassIcon size={18} />
          <input type="search" aria-label="Buscar protocolos" placeholder="Buscar por título ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="segmentos" role="group" aria-label="Filtrar">
          <button aria-pressed={!arquivados} onClick={() => setArquivados(false)}>
            Em uso
          </button>
          <button aria-pressed={arquivados} onClick={() => setArquivados(true)}>
            Arquivados
          </button>
        </div>
      </div>
      {erro && <p className="erro">{erro}</p>}
      {!dados && !erro && <Esqueleto linhas={3} />}
      {dados && grupos.length === 0 && (
        <div className="cartao">
          {busca ? (
            <Vazio>Nada encontrado para "{busca}".</Vazio>
          ) : arquivados ? (
            <Vazio>Nenhum protocolo arquivado.</Vazio>
          ) : (
            <Vazio
              acao={
                <Link to="/mestrado/protocolos/novo" className="botao pequeno">
                  <PlusIcon size={16} /> Escrever protocolo
                </Link>
              }
            >
              Guarde aqui os protocolos que você repete (MTT, passagem, DCFH-DA). Cada edição gera uma nova versão e a anterior fica guardada.
            </Vazio>
          )}
        </div>
      )}
      <div className="pilha">
        {grupos.map(([cat, itens]) => (
          <div key={cat} className="cartao">
            <h2 style={{ marginBottom: '0.25rem' }}>{cat}</h2>
            <ul className="lista">
              {itens.map((p) => (
                <li key={p.id}>
                  <Link to={`/mestrado/protocolos/${p.id}`} className="linha">
                    <div className="corpo">
                      <span className="titulo">{p.titulo}</span>
                      <span className="sub">
                        Versão {p.versao}, {atualizadoEm(p.updated_at)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
