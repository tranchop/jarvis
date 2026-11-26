import {
  ArrowRightIcon,
  BarbellIcon,
  CalendarBlankIcon,
  FlagIcon,
  FlaskIcon,
  HouseLineIcon,
  PillIcon,
  PlusIcon,
  StethoscopeIcon,
  UserCircleIcon,
  WalletIcon,
} from '@phosphor-icons/react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAvisos } from '../components/Avisos'
import { Esqueleto, Vazio } from '../components/Estados'
import { supabase } from '../lib/supabase'
import { concluirTarefa } from '../lib/tarefas'
import type { Consulta, Experimento, Remedio, Tarefa, Tomada } from '../lib/types'
import {
  codigoExp,
  dataRelativa,
  hojeISO,
  inicioSemana,
  intervaloMes,
  mensagemErro,
  mesISO,
  moeda,
  ok,
  somarData,
  useCarregar,
} from '../lib/util'

const AREA_ROTULO: Record<string, string> = { mestrado: 'Mestrado', casa: 'Casa', pessoal: 'Pessoal', alunos: 'Alunos', escotismo: 'Escotismo' }

function diaLocal(isoHora: string) {
  const d = new Date(isoHora)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
const hora = (isoHora: string) => new Date(isoHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

interface ItemAgenda {
  chave: string
  hora: string | null
  titulo: string
  sub?: string
  icone: ReactNode
  to?: string
  dose?: { remedio: Remedio; horario: string; tomada?: Tomada }
}

export default function Inicio() {
  const avisar = useAvisos()
  const hoje = hojeISO()
  const em7 = somarData(hoje, 'semanal')
  const agora = new Date()
  const saudacao = agora.getHours() < 12 ? 'Bom dia' : agora.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const dataExtenso = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const { dados, erro, setDados, recarregar } = useCarregar(async () => {
    const { inicio, fim } = intervaloMes(mesISO())
    const iniHoje = new Date(`${hoje}T00:00`).toISOString()
    const fim7 = new Date(`${em7}T23:59`).toISOString()
    const [tar, exps, cons, rem, tom, fin, tre] = await Promise.all([
      supabase.from('tarefas').select('*').eq('status', 'pendente').eq('arquivado', false).lte('prazo', em7).order('prazo').order('prioridade'),
      supabase.from('experimentos').select('*').eq('arquivado', false).in('status', ['planejado', 'em_andamento']).order('data_planejada'),
      supabase.from('saude_consultas').select('*').eq('arquivado', false).eq('status', 'agendada').gte('data_hora', iniHoje).lte('data_hora', fim7).order('data_hora'),
      supabase.from('saude_remedios').select('*').eq('arquivado', false),
      supabase.from('saude_tomadas').select('*').eq('data', hoje),
      supabase.from('financas').select('tipo, valor').eq('arquivado', false).gte('data', inicio).lte('data', fim),
      supabase.from('treinos').select('duracao_min').eq('arquivado', false).gte('data', inicioSemana(hoje)),
    ])
    const experimentos = ok(exps) as Experimento[]
    const ativos = experimentos.filter((e) => e.status === 'em_andamento')
    let progresso: Record<string, { feitos: number; total: number }> = {}
    if (ativos.length) {
      const passos = ok(await supabase.from('experimento_passos').select('experimento_id, feito').in('experimento_id', ativos.map((e) => e.id))) as {
        experimento_id: string
        feito: boolean
      }[]
      progresso = passos.reduce<typeof progresso>((acc, p) => {
        const x = (acc[p.experimento_id] ??= { feitos: 0, total: 0 })
        x.total++
        if (p.feito) x.feitos++
        return acc
      }, {})
    }
    const lanc = ok(fin) as { tipo: string; valor: number }[]
    const treinos = ok(tre) as { duracao_min: number | null }[]
    return {
      tarefas: ok(tar) as Tarefa[],
      experimentos,
      progresso,
      consultas: ok(cons) as Consulta[],
      remedios: (ok(rem) as Remedio[]).filter((r) => r.inicio <= hoje && (!r.fim || r.fim >= hoje)),
      tomadas: ok(tom) as Tomada[],
      gastos: lanc.filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0),
      treinos: treinos.length,
      minutos: treinos.reduce((s, t) => s + (t.duracao_min ?? 0), 0),
    }
  }, [hoje])

  const visao = useMemo(() => {
    if (!dados) return null
    const agenda: ItemAgenda[] = [
      ...dados.consultas
        .filter((c) => diaLocal(c.data_hora) === hoje)
        .map((c) => ({
          chave: c.id,
          hora: hora(c.data_hora),
          titulo: c.especialidade,
          sub: [c.tipo === 'exame' ? 'Exame' : 'Consulta', c.local].filter(Boolean).join(', '),
          icone: <StethoscopeIcon size={18} />,
          to: '/pessoal/saude',
        })),
      ...dados.remedios.flatMap((r) =>
        r.horarios.map((h) => ({
          chave: `${r.id}-${h}`,
          hora: h,
          titulo: r.nome,
          sub: r.dose ?? undefined,
          icone: <PillIcon size={18} />,
          dose: { remedio: r, horario: h, tomada: dados.tomadas.find((t) => t.remedio_id === r.id && t.horario === h) },
        })),
      ),
      ...dados.experimentos
        .filter((e) => e.status === 'planejado' && e.data_planejada === hoje)
        .map((e) => ({
          chave: e.id,
          hora: null,
          titulo: e.titulo,
          sub: `${codigoExp(e.numero)}, experimento planejado`,
          icone: <FlaskIcon size={18} />,
          to: `/mestrado/experimentos/${e.id}`,
        })),
    ].sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99'))

    const tarefasHoje = dados.tarefas.filter((t) => t.prazo && t.prazo <= hoje)
    type Prox = { titulo: string; sub: string; icone: ReactNode; to: string }
    const proximos = new Map<string, Prox[]>()
    const add = (dia: string, item: Prox) => proximos.set(dia, [...(proximos.get(dia) ?? []), item])
    for (const t of dados.tarefas.filter((t) => t.prazo && t.prazo > hoje))
      add(t.prazo!, {
        titulo: t.titulo,
        sub: `Tarefa, ${AREA_ROTULO[t.area] ?? t.area}`,
        icone: t.area === 'casa' ? <HouseLineIcon size={16} /> : <CalendarBlankIcon size={16} />,
        to: t.area === 'casa' ? '/pessoal/casa' : '/mestrado/tarefas',
      })
    for (const c of dados.consultas.filter((c) => diaLocal(c.data_hora) > hoje))
      add(diaLocal(c.data_hora), { titulo: c.especialidade, sub: `${c.tipo === 'exame' ? 'Exame' : 'Consulta'} às ${hora(c.data_hora)}`, icone: <StethoscopeIcon size={16} />, to: '/pessoal/saude' })
    for (const e of dados.experimentos.filter((e) => e.status === 'planejado' && e.data_planejada && e.data_planejada > hoje && e.data_planejada <= em7))
      add(e.data_planejada!, { titulo: e.titulo, sub: `Experimento ${codigoExp(e.numero)}`, icone: <FlaskIcon size={16} />, to: `/mestrado/experimentos/${e.id}` })

    return {
      agenda,
      dosesPendentes: agenda.filter((a) => a.dose && !a.dose.tomada).length,
      tarefasHoje,
      ativos: dados.experimentos.filter((e) => e.status === 'em_andamento'),
      proximos: [...proximos.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    }
  }, [dados, hoje, em7])

  async function concluir(t: Tarefa) {
    if (!dados) return
    setDados({ ...dados, tarefas: dados.tarefas.filter((x) => x.id !== t.id) })
    try {
      const desfazer = await concluirTarefa(t)
      avisar('Tarefa concluída', {
        desfazer: async () => {
          await desfazer()
          void recarregar()
        },
      })
    } catch (e) {
      avisar(mensagemErro(e), { erro: true })
      void recarregar()
    }
  }

  async function alternarDose(d: NonNullable<ItemAgenda['dose']>) {
    if (!dados) return
    try {
      if (d.tomada) {
        setDados({ ...dados, tomadas: dados.tomadas.filter((x) => x.id !== d.tomada!.id) })
        ok(await supabase.from('saude_tomadas').delete().eq('id', d.tomada.id))
      } else {
        const nova = ok(await supabase.from('saude_tomadas').insert({ remedio_id: d.remedio.id, horario: d.horario, data: hoje }).select('*').single()) as Tomada
        setDados({ ...dados, tomadas: [...dados.tomadas, nova] })
      }
    } catch (e) {
      avisar(mensagemErro(e), { erro: true })
      void recarregar()
    }
  }

  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <h1>{saudacao}, Pedro</h1>
          <p className="sutil primeira-maiuscula">{dataExtenso}</p>
        </div>
        <Link to="/conta" className="botao icone-btn so-mobile" aria-label="Conta e senha">
          <UserCircleIcon size={26} />
        </Link>
      </header>

      <TarefaRapida aoCriar={() => void recarregar()} />

      {erro && <p className="erro">{erro}</p>}
      {!dados && !erro && <Esqueleto linhas={5} />}

      {dados && visao && (
        <div className="painel-geral">
          <div className="pilha">
            <div className="cartao">
              <div className="cartao-topo">
                <h2>Agenda de hoje</h2>
                {visao.dosesPendentes > 0 && (
                  <span className="sutil pequeno">
                    {visao.dosesPendentes} {visao.dosesPendentes === 1 ? 'dose pendente' : 'doses pendentes'}
                  </span>
                )}
              </div>
              {visao.agenda.length === 0 ? (
                <Vazio>Nada marcado para hoje: nenhuma consulta, dose ou experimento.</Vazio>
              ) : (
                <ul className="lista agenda">
                  {visao.agenda.map((a) => {
                    const conteudo = (
                      <>
                        <span className="hora-agenda">{a.hora ?? 'Dia'}</span>
                        <span className="icone-agenda">{a.icone}</span>
                        <span className="corpo">
                          <span className="titulo">{a.titulo}</span>
                          {a.sub && <span className="sub">{a.sub}</span>}
                        </span>
                      </>
                    )
                    if (a.dose)
                      return (
                        <li key={a.chave}>
                          <label className={`linha item-agenda ${a.dose.tomada ? 'item-feito' : ''}`}>
                            {conteudo}
                            <input type="checkbox" aria-label={`Tomei ${a.titulo} das ${a.hora}`} checked={Boolean(a.dose.tomada)} onChange={() => void alternarDose(a.dose!)} />
                          </label>
                        </li>
                      )
                    return (
                      <li key={a.chave}>
                        <Link to={a.to!} className="linha item-agenda">
                          {conteudo}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="cartao">
              <div className="cartao-topo">
                <h2>Tarefas para hoje</h2>
                {visao.tarefasHoje.length > 0 && <span className="sutil pequeno">{visao.tarefasHoje.length}</span>}
              </div>
              {visao.tarefasHoje.length === 0 ? (
                <Vazio>Nenhuma tarefa vencendo hoje.</Vazio>
              ) : (
                <ul className="lista">
                  {visao.tarefasHoje.map((t) => (
                    <li key={t.id} className="linha tarefa">
                      <input type="checkbox" aria-label={`Concluir ${t.titulo}`} checked={false} onChange={() => void concluir(t)} />
                      <div className="corpo">
                        <span className="titulo">{t.titulo}</span>
                        <span className="sub">
                          <span>{AREA_ROTULO[t.area] ?? t.area}</span>
                          {t.prazo! < hoje && <span className="atrasada">Atrasada desde {dataRelativa(t.prazo).toLowerCase()}</span>}
                          {t.prioridade === 1 && (
                            <span className="prioridade-alta">
                              <FlagIcon size={13} weight="fill" /> Alta
                            </span>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="pilha">
            {visao.ativos.map((e) => {
              const p = dados.progresso[e.id] ?? { feitos: 0, total: 0 }
              return (
                <Link key={e.id} to={`/mestrado/experimentos/${e.id}`} className="cartao cartao-link destaque">
                  <span className="rotulo">Experimento em andamento</span>
                  <h2>{e.titulo}</h2>
                  {p.total > 0 && (
                    <div className="progresso">
                      <div className="barra" aria-hidden>
                        <div style={{ transform: `scaleX(${p.feitos / p.total})` }} />
                      </div>
                      <span className="sutil pequeno">
                        {p.feitos} de {p.total}
                      </span>
                    </div>
                  )}
                  <span className="texto-btn" style={{ padding: 0 }}>
                    Abrir bancada <ArrowRightIcon size={16} />
                  </span>
                </Link>
              )
            })}

            <div className="mini-numeros">
              <Link to="/pessoal/financas" className="cartao cartao-link">
                <span className="cab-mini">
                  <WalletIcon size={18} /> Gastos do mês
                </span>
                <span className="num">{moeda(dados.gastos)}</span>
              </Link>
              <Link to="/pessoal/treinos" className="cartao cartao-link">
                <span className="cab-mini">
                  <BarbellIcon size={18} /> Treinos na semana
                </span>
                <span className="num">{dados.treinos}</span>
                {dados.minutos > 0 && <span className="sutil pequeno">{dados.minutos} min</span>}
              </Link>
            </div>

            <div className="cartao">
              <h2 style={{ marginBottom: '0.25rem' }}>Próximos 7 dias</h2>
              {visao.proximos.length === 0 ? (
                <Vazio>Semana livre: nenhuma tarefa, consulta ou experimento agendado.</Vazio>
              ) : (
                visao.proximos.map(([dia, itens]) => (
                  <div key={dia} className="dia">
                    <p className="dia-rotulo">{dataRelativa(dia)}</p>
                    <ul className="lista">
                      {itens.map((i, n) => (
                        <li key={n}>
                          <Link to={i.to} className="linha">
                            <span className="icone-agenda">{i.icone}</span>
                            <span className="corpo">
                              <span className="titulo">{i.titulo}</span>
                              <span className="sub">{i.sub}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// Adicionar tarefa sem sair da tela inicial
function TarefaRapida({ aoCriar }: { aoCriar: () => void }) {
  const avisar = useAvisos()
  const [titulo, setTitulo] = useState('')
  const [area, setArea] = useState<'mestrado' | 'casa'>('mestrado')
  const [quando, setQuando] = useState<'hoje' | 'amanha' | 'sem'>('hoje')
  const hoje = hojeISO()

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    try {
      ok(
        await supabase.from('tarefas').insert({
          titulo: titulo.trim(),
          area,
          prazo: quando === 'hoje' ? hoje : quando === 'amanha' ? somarData(hoje, 'diaria') : null,
        }),
      )
      setTitulo('')
      avisar(`Tarefa adicionada em ${area === 'casa' ? 'Casa' : 'Mestrado'}`)
      aoCriar()
    } catch (err) {
      avisar(mensagemErro(err), { erro: true })
    }
  }

  return (
    <form className="cartao rapida" onSubmit={criar} style={{ marginBottom: '1rem' }}>
      <div className="rapida-linha">
        <input aria-label="Nova tarefa" placeholder="Anotar uma tarefa" maxLength={300} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <button className="primario" disabled={!titulo.trim()} aria-label="Adicionar tarefa">
          <PlusIcon size={18} weight="bold" />
        </button>
      </div>
      {titulo.trim() && (
        <div className="chips">
          {(['mestrado', 'casa'] as const).map((a) => (
            <button key={a} type="button" className="chip" aria-pressed={area === a} onClick={() => setArea(a)}>
              {a === 'casa' ? 'Casa' : 'Mestrado'}
            </button>
          ))}
          <span className="separador-chips" aria-hidden />
          {(
            [
              ['hoje', 'Hoje'],
              ['amanha', 'Amanhã'],
              ['sem', 'Sem prazo'],
            ] as const
          ).map(([v, r]) => (
            <button key={v} type="button" className="chip" aria-pressed={quando === v} onClick={() => setQuando(v)}>
              {r}
            </button>
          ))}
        </div>
      )}
    </form>
  )
}
