import { useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { CATEGORIAS_TAREFA, type Recorrencia, type Tarefa } from '../../lib/types'
import { formatarData, hojeISO, mensagemErro, ok, somarData, useCarregar, vazioParaNull } from '../../lib/util'

const REC: Record<Recorrencia, string> = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' }

export default function Tarefas() {
  const [verFeitas, setVerFeitas] = useState(false)
  const { dados, erro, setDados, recarregar } = useCarregar(
    async () =>
      ok(
        await supabase
          .from('tarefas')
          .select('*')
          .eq('area', 'mestrado')
          .eq('arquivado', false)
          .eq('status', verFeitas ? 'feita' : 'pendente')
          .order('prazo', { ascending: !verFeitas, nullsFirst: false })
          .limit(verFeitas ? 50 : 500),
      ) as Tarefa[],
    [verFeitas],
  )
  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [prioridade, setPrioridade] = useState<1 | 2 | 3>(2)
  const [recorrencia, setRecorrencia] = useState<'' | Recorrencia>('')
  const [falha, setFalha] = useState<string | null>(null)

  const hoje = hojeISO()
  const grupos = useMemo(() => {
    const l = dados ?? []
    if (verFeitas) return [['Concluídas', l] as const]
    return (
      [
        ['Atrasadas', l.filter((t) => t.prazo && t.prazo < hoje)],
        ['Hoje', l.filter((t) => t.prazo === hoje)],
        ['Próximas', l.filter((t) => t.prazo && t.prazo > hoje)],
        ['Sem prazo', l.filter((t) => !t.prazo)],
      ] as const
    ).filter(([, x]) => x.length > 0)
  }, [dados, hoje, verFeitas])

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    setFalha(null)
    try {
      const t = ok(
        await supabase
          .from('tarefas')
          .insert({
            titulo: titulo.trim(),
            area: 'mestrado',
            prazo: prazo || null,
            categoria: vazioParaNull(categoria),
            prioridade,
            recorrencia: recorrencia || null,
          })
          .select('*')
          .single(),
      ) as Tarefa
      if (!verFeitas) setDados([...(dados ?? []), t])
      setTitulo('')
      setPrazo('')
      setRecorrencia('')
    } catch (err) {
      setFalha(mensagemErro(err))
    }
  }

  async function concluir(t: Tarefa) {
    setFalha(null)
    try {
      ok(
        await supabase
          .from('tarefas')
          .update({ status: 'feita', concluida_em: new Date().toISOString() })
          .eq('id', t.id),
      )
      // recorrente: cria a próxima ocorrência
      if (t.recorrencia) {
        ok(
          await supabase.from('tarefas').insert({
            titulo: t.titulo,
            descricao: t.descricao,
            area: t.area,
            categoria: t.categoria,
            prioridade: t.prioridade,
            recorrencia: t.recorrencia,
            prazo: somarData(t.prazo ?? hoje, t.recorrencia),
            origem_id: t.origem_id ?? t.id,
            experimento_id: t.experimento_id,
          }),
        )
      }
      await recarregar()
    } catch (err) {
      setFalha(mensagemErro(err))
    }
  }

  async function reabrir(t: Tarefa) {
    const r = await supabase.from('tarefas').update({ status: 'pendente', concluida_em: null }).eq('id', t.id)
    if (r.error) setFalha(r.error.message)
    else void recarregar()
  }

  async function arquivar(t: Tarefa) {
    if (!confirm(`Arquivar "${t.titulo}"?`)) return
    const r = await supabase.from('tarefas').update({ arquivado: true }).eq('id', t.id)
    if (r.error) setFalha(r.error.message)
    else setDados((dados ?? []).filter((x) => x.id !== t.id))
  }

  return (
    <section>
      <header className="cabecalho">
        <h1>Tarefas do mestrado</h1>
        <label className="check">
          <input type="checkbox" checked={verFeitas} onChange={(e) => setVerFeitas(e.target.checked)} /> Concluídas
        </label>
      </header>

      <form className="cartao formulario nova-tarefa" onSubmit={adicionar}>
        <input
          placeholder="Nova tarefa (ex.: ler artigo sobre GR em SH-SY5Y)"
          maxLength={300}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <div className="linha">
          <input type="date" aria-label="Prazo" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          <select aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Categoria</option>
            {CATEGORIAS_TAREFA.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Prioridade"
            value={prioridade}
            onChange={(e) => setPrioridade(Number(e.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>Alta</option>
            <option value={2}>Média</option>
            <option value={3}>Baixa</option>
          </select>
          <select
            aria-label="Recorrência"
            value={recorrencia}
            onChange={(e) => setRecorrencia(e.target.value as '' | Recorrencia)}
          >
            <option value="">Não repete</option>
            {Object.entries(REC).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
          <button className="primario">Adicionar</button>
        </div>
      </form>

      {(erro || falha) && <p className="erro">{erro ?? falha}</p>}
      {dados && grupos.length === 0 && <p className="sutil">Nenhuma tarefa.</p>}

      {grupos.map(([nome, itens]) => (
        <div key={nome} className="cartao">
          <h2 className={nome === 'Atrasadas' ? 'atrasada' : ''}>
            {nome} <span className="sutil pequeno">{itens.length}</span>
          </h2>
          <ul className="lista">
            {itens.map((t) => (
              <li key={t.id} className="linha-lista tarefa">
                <input
                  type="checkbox"
                  className="check-tarefa"
                  aria-label="Concluir"
                  checked={t.status === 'feita'}
                  onChange={() => void (t.status === 'feita' ? reabrir(t) : concluir(t))}
                />
                <span className={`prioridade p${t.prioridade}`} />
                <span className="cresce">
                  {t.titulo}
                  <span className="sutil pequeno bloco">
                    {[t.categoria, t.recorrencia && `↻ ${REC[t.recorrencia]}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={`pequeno ${t.prazo && t.prazo < hoje && t.status === 'pendente' ? 'atrasada' : 'sutil'}`}>
                  {formatarData(t.prazo)}
                </span>
                <button type="button" className="icone-btn" aria-label="Arquivar" onClick={() => void arquivar(t)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
