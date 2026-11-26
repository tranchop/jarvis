import { ArchiveIcon, CaretDownIcon, FlagIcon, PlusIcon, RepeatIcon } from '@phosphor-icons/react'
import { useMemo, useState, type FormEvent } from 'react'
import { useAvisos } from '../../components/Avisos'
import { Esqueleto, Vazio } from '../../components/Estados'
import { supabase } from '../../lib/supabase'
import { concluirTarefa } from '../../lib/tarefas'
import { CATEGORIAS_TAREFA, type Recorrencia, type Tarefa } from '../../lib/types'
import { dataRelativa, estaAtrasada, hojeISO, mensagemErro, ok, somarData, useCarregar, vazioParaNull } from '../../lib/util'

const REC: Record<Recorrencia, string> = { diaria: 'Todo dia', semanal: 'Toda semana', mensal: 'Todo mês' }

function proximaSegunda(): string {
  const d = new Date()
  const ate = ((8 - d.getDay()) % 7) || 7
  let iso = hojeISO()
  for (let i = 0; i < ate; i++) iso = somarData(iso, 'diaria')
  return iso
}

interface Props {
  area: 'mestrado' | 'casa'
  titulo: string
  subtitulo: string
  categorias: string[]
  vazio: string
  repeticaoPadrao?: '' | Recorrencia
}

export default function Tarefas() {
  return (
    <ListaTarefas
      area="mestrado"
      titulo="Tarefas"
      subtitulo="Mestrado"
      categorias={CATEGORIAS_TAREFA}
      vazio="Nada pendente. Escreva acima a próxima leitura, trecho da dissertação ou reunião com a orientadora."
    />
  )
}

export function ListaTarefas({ area, titulo: tituloPagina, subtitulo, categorias, vazio, repeticaoPadrao = '' }: Props) {
  const avisar = useAvisos()
  const [verFeitas, setVerFeitas] = useState(false)
  const { dados, erro, setDados, recarregar } = useCarregar(
    async () =>
      ok(
        await supabase
          .from('tarefas')
          .select('*')
          .eq('area', area)
          .eq('arquivado', false)
          .eq('status', verFeitas ? 'feita' : 'pendente')
          .order(verFeitas ? 'concluida_em' : 'prazo', { ascending: !verFeitas, nullsFirst: false })
          .limit(verFeitas ? 50 : 500),
      ) as Tarefa[],
    [verFeitas, area],
  )
  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')
  const [opcoes, setOpcoes] = useState(false)
  const [categoria, setCategoria] = useState('')
  const [prioridade, setPrioridade] = useState<1 | 2 | 3>(2)
  const [recorrencia, setRecorrencia] = useState<'' | Recorrencia>(repeticaoPadrao)

  const hoje = hojeISO()
  const amanha = somarData(hoje, 'diaria')
  const semana = somarData(hoje, 'semanal')
  const atalhos = [
    { r: 'Hoje', v: hoje },
    { r: 'Amanhã', v: amanha },
    { r: 'Próxima segunda', v: proximaSegunda() },
  ]

  const grupos = useMemo(() => {
    const l = dados ?? []
    if (verFeitas) return [['Concluídas recentemente', l] as const]
    return (
      [
        ['Atrasadas', l.filter((t) => t.prazo && t.prazo < hoje)],
        ['Hoje', l.filter((t) => t.prazo === hoje)],
        ['Próximos 7 dias', l.filter((t) => t.prazo && t.prazo > hoje && t.prazo <= semana)],
        ['Mais adiante', l.filter((t) => t.prazo && t.prazo > semana)],
        ['Sem prazo', l.filter((t) => !t.prazo)],
      ] as const
    ).filter(([, x]) => x.length > 0)
  }, [dados, hoje, semana, verFeitas])

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    try {
      const t = ok(
        await supabase
          .from('tarefas')
          .insert({
            titulo: titulo.trim(),
            area,
            prazo: prazo || null,
            categoria: vazioParaNull(categoria),
            prioridade,
            recorrencia: recorrencia || null,
          })
          .select('*')
          .single(),
      ) as Tarefa
      if (!verFeitas) setDados([...(dados ?? []), t].sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999')))
      setTitulo('')
      setPrazo('')
      setRecorrencia(repeticaoPadrao)
      setPrioridade(2)
      avisar('Tarefa adicionada')
    } catch (err) {
      avisar(mensagemErro(err), { erro: true })
    }
  }

  async function concluir(t: Tarefa) {
    setDados((dados ?? []).filter((x) => x.id !== t.id))
    try {
      const desfazer = await concluirTarefa(t)
      avisar(t.recorrencia ? 'Concluída. A próxima já está agendada.' : 'Tarefa concluída', {
        desfazer: async () => {
          await desfazer()
          void recarregar()
        },
      })
      if (t.recorrencia) void recarregar()
    } catch (err) {
      avisar(mensagemErro(err), { erro: true })
      void recarregar()
    }
  }

  async function reabrir(t: Tarefa) {
    setDados((dados ?? []).filter((x) => x.id !== t.id))
    const r = await supabase.from('tarefas').update({ status: 'pendente', concluida_em: null }).eq('id', t.id)
    if (r.error) avisar(r.error.message, { erro: true })
    else avisar('Tarefa reaberta')
  }

  async function arquivar(t: Tarefa) {
    setDados((dados ?? []).filter((x) => x.id !== t.id))
    const r = await supabase.from('tarefas').update({ arquivado: true }).eq('id', t.id)
    if (r.error) {
      avisar(r.error.message, { erro: true })
      return void recarregar()
    }
    avisar('Tarefa arquivada', {
      desfazer: async () => {
        await supabase.from('tarefas').update({ arquivado: false }).eq('id', t.id)
        void recarregar()
      },
    })
  }

  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <h1>{tituloPagina}</h1>
          <p className="sutil pequeno">{subtitulo}</p>
        </div>
        <div className="segmentos" role="group" aria-label="Mostrar">
          <button aria-pressed={!verFeitas} onClick={() => setVerFeitas(false)}>
            Pendentes
          </button>
          <button aria-pressed={verFeitas} onClick={() => setVerFeitas(true)}>
            Concluídas
          </button>
        </div>
      </header>

      {!verFeitas && (
        <form className="cartao rapida" onSubmit={adicionar} style={{ marginBottom: '1rem' }}>
          <div className="rapida-linha">
            <input aria-label="Nova tarefa" placeholder="Nova tarefa" maxLength={300} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <button className="primario" disabled={!titulo.trim()} aria-label="Adicionar tarefa">
              <PlusIcon size={18} weight="bold" />
              <span className="so-pc">Adicionar</span>
            </button>
          </div>
          {titulo.trim() && (
            <>
              <div className="chips" role="group" aria-label="Prazo">
                {atalhos.map((a) => (
                  <button key={a.r} type="button" className="chip" aria-pressed={prazo === a.v} onClick={() => setPrazo(prazo === a.v ? '' : a.v)}>
                    {a.r}
                  </button>
                ))}
                <input type="date" aria-label="Outra data" className="chip" style={{ minHeight: 36 }} value={atalhos.some((a) => a.v === prazo) ? '' : prazo} onChange={(e) => setPrazo(e.target.value)} />
                <button type="button" className="chip" aria-expanded={opcoes} onClick={() => setOpcoes(!opcoes)}>
                  Mais opções <CaretDownIcon size={14} style={{ rotate: opcoes ? '180deg' : '0deg' }} />
                </button>
              </div>
              {opcoes && (
                <div className="opcoes">
                  <label>
                    Categoria
                    <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                      <option value="">Nenhuma</option>
                      {categorias.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prioridade
                    <select value={prioridade} onChange={(e) => setPrioridade(Number(e.target.value) as 1 | 2 | 3)}>
                      <option value={1}>Alta</option>
                      <option value={2}>Normal</option>
                      <option value={3}>Baixa</option>
                    </select>
                  </label>
                  <label>
                    Repetir
                    <select value={recorrencia} onChange={(e) => setRecorrencia(e.target.value as '' | Recorrencia)}>
                      <option value="">Não repete</option>
                      {Object.entries(REC).map(([v, r]) => (
                        <option key={v} value={v}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </>
          )}
        </form>
      )}

      {erro && <p className="erro">{erro}</p>}
      {!dados && !erro && <Esqueleto linhas={4} />}
      {dados && grupos.length === 0 && (
        <div className="cartao">
          <Vazio>
            {verFeitas
              ? 'Nenhuma tarefa concluída ainda.'
              : vazio}
          </Vazio>
        </div>
      )}

      <div className="pilha">
        {grupos.map(([nome, itens]) => (
          <div key={nome} className="cartao grupo-tarefas">
            <h2 className={nome === 'Atrasadas' ? 'atrasada' : ''}>
              {nome} <span className="n">{itens.length}</span>
            </h2>
            <ul className="lista">
              {itens.map((t) => (
                <li key={t.id} className="linha tarefa">
                  <input
                    type="checkbox"
                    aria-label={t.status === 'feita' ? `Reabrir ${t.titulo}` : `Concluir ${t.titulo}`}
                    checked={t.status === 'feita'}
                    onChange={() => void (t.status === 'feita' ? reabrir(t) : concluir(t))}
                  />
                  <div className="corpo">
                    <span className="titulo">{t.titulo}</span>
                    <span className="sub">
                      {nome !== 'Hoje' && <span className={t.status === 'pendente' && estaAtrasada(t.prazo) ? 'atrasada' : ''}>{dataRelativa(t.prazo)}</span>}
                      {t.categoria && <span>{t.categoria}</span>}
                      {t.recorrencia && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <RepeatIcon size={13} /> {REC[t.recorrencia]}
                        </span>
                      )}
                      {t.prioridade === 1 && (
                        <span className="prioridade-alta">
                          <FlagIcon size={13} weight="fill" /> Alta
                        </span>
                      )}
                    </span>
                  </div>
                  <button className="icone-btn" aria-label={`Arquivar ${t.titulo}`} title="Arquivar" onClick={() => void arquivar(t)}>
                    <ArchiveIcon size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
