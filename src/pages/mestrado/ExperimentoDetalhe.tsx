import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  DotsThreeIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  SunIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAvisos } from '../../components/Avisos'
import { Esqueleto, Vazio } from '../../components/Estados'
import { supabase } from '../../lib/supabase'
import {
  MODELOS_CELULARES,
  STATUS_EXP,
  type Experimento,
  type Material,
  type Passo,
  type Protocolo,
  type StatusExperimento,
} from '../../lib/types'
import {
  codigoExp,
  dataRelativa,
  hojeISO,
  linkDriveSeguro,
  mensagemErro,
  ok,
  useCarregar,
  vazioParaNull,
} from '../../lib/util'

interface Form {
  titulo: string
  objetivo: string
  modelo_celular: string
  data_planejada: string
  data_execucao: string
  status: StatusExperimento
  link_drive: string
  observacoes: string
  resultados: string
}

const FORM_VAZIO: Form = {
  titulo: '',
  objetivo: '',
  modelo_celular: '',
  data_planejada: '',
  data_execucao: '',
  status: 'planejado',
  link_drive: '',
  observacoes: '',
  resultados: '',
}

function paraForm(e: Experimento): Form {
  return {
    titulo: e.titulo,
    objetivo: e.objetivo ?? '',
    modelo_celular: e.modelo_celular ?? '',
    data_planejada: e.data_planejada ?? '',
    data_execucao: e.data_execucao ?? '',
    status: e.status,
    link_drive: e.link_drive ?? '',
    observacoes: e.observacoes ?? '',
    resultados: e.resultados ?? '',
  }
}

function paraBanco(f: Form) {
  return {
    titulo: f.titulo.trim(),
    objetivo: vazioParaNull(f.objetivo),
    modelo_celular: vazioParaNull(f.modelo_celular),
    data_planejada: f.data_planejada || null,
    data_execucao: f.data_execucao || null,
    status: f.status,
    link_drive: vazioParaNull(f.link_drive),
    observacoes: vazioParaNull(f.observacoes),
    resultados: vazioParaNull(f.resultados),
  }
}

type Aba = 'passos' | 'materiais' | 'protocolos' | 'dados'

export default function ExperimentoDetalhe() {
  const { id } = useParams()
  const novo = id === 'novo'
  const navigate = useNavigate()
  const avisar = useAvisos()
  const [form, setForm] = useState<Form>(FORM_VAZIO)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [aba, setAba] = useState<Aba>('passos')
  const [contagem, setContagem] = useState({ feitos: 0, total: 0 })

  const exp = useCarregar(async () => {
    if (novo || !id) return null
    return ok(await supabase.from('experimentos').select('*').eq('id', id).single()) as Experimento
  }, [id])

  useEffect(() => {
    setForm(exp.dados ? paraForm(exp.dados) : FORM_VAZIO)
  }, [exp.dados])

  const base = useMemo(() => (exp.dados ? paraForm(exp.dados) : FORM_VAZIO), [exp.dados])
  const alterado = !novo && JSON.stringify(base) !== JSON.stringify(form)

  // avisa antes de fechar a página com alterações não salvas
  useEffect(() => {
    if (!alterado) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [alterado])

  function campo<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function salvar(e?: FormEvent) {
    e?.preventDefault()
    setErroForm(null)
    if (!form.titulo.trim()) return setErroForm('Dê um título ao experimento.')
    if (form.link_drive.trim() && !linkDriveSeguro(form.link_drive.trim())) {
      return setErroForm('O link precisa ser de uma pasta do Google Drive (https://drive.google.com/...).')
    }
    setSalvando(true)
    try {
      if (novo) {
        const criado = ok(await supabase.from('experimentos').insert(paraBanco(form)).select('id').single()) as {
          id: string
        }
        navigate(`/mestrado/experimentos/${criado.id}`, { replace: true })
        avisar('Experimento criado. Agora monte o passo a passo.')
      } else {
        exp.setDados(
          ok(await supabase.from('experimentos').update(paraBanco(form)).eq('id', id!).select('*').single()) as Experimento,
        )
        avisar('Alterações salvas')
      }
    } catch (err) {
      setErroForm(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function atualizar(campos: Partial<Experimento>, msg: string, desfazer?: Partial<Experimento>) {
    try {
      exp.setDados(
        ok(await supabase.from('experimentos').update(campos).eq('id', id!).select('*').single()) as Experimento,
      )
      avisar(msg, desfazer ? { desfazer: () => atualizar(desfazer, 'Desfeito') } : undefined)
    } catch (err) {
      avisar(mensagemErro(err), { erro: true })
    }
  }

  async function duplicar() {
    if (!exp.dados) return
    try {
      const b = paraBanco(paraForm(exp.dados))
      const novoExp = ok(
        await supabase
          .from('experimentos')
          .insert({ ...b, titulo: `${b.titulo} (cópia)`, status: 'planejado', data_execucao: null, resultados: null })
          .select('id')
          .single(),
      ) as { id: string }
      const [passos, mats, prots] = await Promise.all([
        supabase.from('experimento_passos').select('ordem, descricao, duracao_min').eq('experimento_id', id!),
        supabase.from('experimento_materiais').select('nome, quantidade, observacao').eq('experimento_id', id!),
        supabase.from('experimento_protocolos').select('protocolo_id').eq('experimento_id', id!),
      ])
      const comId = (l: object[]) => l.map((x) => ({ ...x, experimento_id: novoExp.id }))
      const p = ok(passos) as object[]
      const m = ok(mats) as object[]
      const pr = ok(prots) as object[]
      if (p.length) ok(await supabase.from('experimento_passos').insert(comId(p)))
      if (m.length) ok(await supabase.from('experimento_materiais').insert(comId(m)))
      if (pr.length) ok(await supabase.from('experimento_protocolos').insert(comId(pr)))
      navigate(`/mestrado/experimentos/${novoExp.id}`)
      avisar('Cópia criada com passos, materiais e protocolos')
    } catch (err) {
      avisar(mensagemErro(err), { erro: true })
    }
  }

  if (exp.erro) return <p className="erro">{exp.erro}</p>
  if (!novo && !exp.dados) return <Esqueleto linhas={5} />
  const e = exp.dados
  const link = linkDriveSeguro(e?.link_drive ?? null)
  const oculta = (a: Aba) => (!novo && aba !== a ? 'true' : 'false')

  const formulario = (
    <form className="cartao formulario" onSubmit={salvar} data-aba-oculta={oculta('dados')} noValidate>
      {!novo && <h2>Dados</h2>}
      <label>
        Título
        <input required maxLength={200} value={form.titulo} onChange={(ev) => campo('titulo', ev.target.value)} />
      </label>
      <label>
        Objetivo
        <textarea rows={3} maxLength={5000} value={form.objetivo} onChange={(ev) => campo('objetivo', ev.target.value)} />
      </label>
      <div className="duas">
        <label>
          Modelo celular
          <input
            list="modelos"
            maxLength={120}
            value={form.modelo_celular}
            onChange={(ev) => campo('modelo_celular', ev.target.value)}
          />
          <datalist id="modelos">
            {MODELOS_CELULARES.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label>
          Status
          <select value={form.status} onChange={(ev) => campo('status', ev.target.value as StatusExperimento)}>
            {Object.entries(STATUS_EXP).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data planejada
          <input type="date" value={form.data_planejada} onChange={(ev) => campo('data_planejada', ev.target.value)} />
        </label>
        <label>
          Data de execução
          <input type="date" value={form.data_execucao} onChange={(ev) => campo('data_execucao', ev.target.value)} />
        </label>
      </div>
      <label>
        Pasta de resultados no Google Drive
        <input
          type="url"
          inputMode="url"
          placeholder="https://drive.google.com/..."
          value={form.link_drive}
          onChange={(ev) => campo('link_drive', ev.target.value)}
        />
      </label>
      {!novo && (
        <>
          <label>
            Observações
            <textarea rows={3} maxLength={20000} value={form.observacoes} onChange={(ev) => campo('observacoes', ev.target.value)} />
          </label>
          <label>
            Resultados e conclusões
            <textarea rows={4} maxLength={20000} value={form.resultados} onChange={(ev) => campo('resultados', ev.target.value)} />
          </label>
        </>
      )}
      {erroForm && (
        <p className="erro" role="alert">
          {erroForm}
        </p>
      )}
      {novo && (
        <div>
          <button className="primario" disabled={salvando}>
            {salvando ? 'Criando...' : 'Criar e montar passo a passo'}
          </button>
        </div>
      )}
    </form>
  )

  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <Link to="/mestrado/experimentos" className="voltar">
            <ArrowLeftIcon size={16} /> Experimentos
          </Link>
          <h1>{novo ? 'Novo experimento' : e!.titulo}</h1>
          {e && (
            <div className="meta">
              <span className="codigo">{codigoExp(e.numero)}</span>
              <span className={`selo ${e.status}`}>{STATUS_EXP[e.status]}</span>
              {e.arquivado && <span className="selo neutro">Arquivado</span>}
              {e.modelo_celular && <span>{e.modelo_celular}</span>}
              <span>{dataRelativa(e.data_execucao ?? e.data_planejada, 'Sem data')}</span>
            </div>
          )}
        </div>
        {e && (
          <div className="acoes">
            {e.status === 'planejado' && !e.arquivado && (
              <button
                className="primario so-pc"
                onClick={() =>
                  void atualizar({ status: 'em_andamento', data_execucao: hojeISO() }, 'Experimento iniciado', {
                    status: 'planejado',
                    data_execucao: e.data_execucao,
                  })
                }
              >
                <PlayIcon size={18} weight="fill" /> Iniciar
              </button>
            )}
            {e.status === 'em_andamento' && (
              <button
                className="so-pc"
                onClick={() => void atualizar({ status: 'concluido' }, 'Experimento concluído', { status: 'em_andamento' })}
              >
                <CheckIcon size={18} /> Concluir
              </button>
            )}
            {link && (
              <a className="botao icone-btn" href={link} target="_blank" rel="noopener noreferrer" aria-label="Abrir resultados no Drive" title="Resultados no Drive">
                <ArrowSquareOutIcon size={22} />
              </a>
            )}
            <MenuAcoes>
              {e.status === 'planejado' && !e.arquivado && (
                <button
                  className="so-mobile"
                  onClick={() =>
                    void atualizar({ status: 'em_andamento', data_execucao: hojeISO() }, 'Experimento iniciado', {
                      status: 'planejado',
                      data_execucao: e.data_execucao,
                    })
                  }
                >
                  <PlayIcon size={18} /> Iniciar experimento
                </button>
              )}
              {e.status === 'em_andamento' && (
                <button className="so-mobile" onClick={() => void atualizar({ status: 'concluido' }, 'Experimento concluído', { status: 'em_andamento' })}>
                  <CheckIcon size={18} /> Marcar como concluído
                </button>
              )}
              <button onClick={() => void duplicar()}>
                <CopyIcon size={18} /> Duplicar
              </button>
              <button
                onClick={() =>
                  void atualizar(
                    { arquivado: !e.arquivado },
                    e.arquivado ? 'Experimento desarquivado' : 'Experimento arquivado',
                    { arquivado: e.arquivado },
                  )
                }
              >
                <ArchiveIcon size={18} /> {e.arquivado ? 'Desarquivar' : 'Arquivar'}
              </button>
            </MenuAcoes>
          </div>
        )}
      </header>

      {novo ? (
        <div style={{ maxWidth: 720 }}>{formulario}</div>
      ) : (
        <>
          <div className="abas" role="tablist" aria-label="Seções do experimento">
            {(
              [
                ['passos', 'Passos', contagem.total ? `${contagem.feitos}/${contagem.total}` : ''],
                ['materiais', 'Materiais', ''],
                ['protocolos', 'Protocolos', ''],
                ['dados', 'Dados', alterado ? '•' : ''],
              ] as const
            ).map(([v, r, c]) => (
              <button key={v} role="tab" aria-selected={aba === v} onClick={() => setAba(v)}>
                {r}
                {c && <span className="contador">{c}</span>}
              </button>
            ))}
          </div>
          <div className="detalhe-grade">
            <div className="pilha">
              <Bancada experimentoId={id!} oculta={oculta('passos')} onContagem={setContagem} />
              <Materiais experimentoId={id!} oculta={oculta('materiais')} />
            </div>
            <div className="pilha">
              {formulario}
              <ProtocolosVinculados experimentoId={id!} oculta={oculta('protocolos')} />
            </div>
          </div>
          {alterado && (
            <div className="barra-salvar" role="region" aria-label="Alterações não salvas">
              <span className="pequeno">Alterações não salvas nos dados</span>
              <div className="acoes">
                <button className="pequeno" onClick={() => setForm(base)}>
                  Descartar
                </button>
                <button className="primario pequeno" disabled={salvando} onClick={() => void salvar()}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function MenuAcoes({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const fechar = (ev: MouseEvent | KeyboardEvent) => {
      const d = ref.current
      if (!d?.open) return
      if (ev instanceof KeyboardEvent ? ev.key === 'Escape' : !d.contains(ev.target as Node)) d.open = false
    }
    document.addEventListener('click', fechar)
    document.addEventListener('keydown', fechar)
    return () => {
      document.removeEventListener('click', fechar)
      document.removeEventListener('keydown', fechar)
    }
  }, [])
  return (
    <details className="menu" ref={ref}>
      <summary className="botao icone-btn" aria-label="Mais ações">
        <DotsThreeIcon size={24} weight="bold" />
      </summary>
      <div className="menu-lista" onClick={() => ref.current && (ref.current.open = false)}>
        {children}
      </div>
    </details>
  )
}

// ---------------- Passo a passo (modo bancada) ----------------
function Bancada({
  experimentoId,
  oculta,
  onContagem,
}: {
  experimentoId: string
  oculta: string
  onContagem: (c: { feitos: number; total: number }) => void
}) {
  const avisar = useAvisos()
  const { dados, erro, setDados, recarregar } = useCarregar(
    async () =>
      ok(await supabase.from('experimento_passos').select('*').eq('experimento_id', experimentoId).order('ordem')) as Passo[],
    [experimentoId],
  )
  const [editando, setEditando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [novo, setNovo] = useState('')
  const [telaLigada, setTelaLigada] = useState(false)
  const wake = useRef<WakeLockSentinel | null>(null)
  const podeManterTela = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  const passos = useMemo(() => dados ?? [], [dados])
  const feitos = passos.filter((p) => p.feito).length

  useEffect(() => onContagem({ feitos, total: passos.length }), [feitos, passos.length, onContagem])
  useEffect(
    () => () => {
      void wake.current?.release()
    },
    [],
  )

  async function alternarTela() {
    try {
      if (wake.current) {
        await wake.current.release()
        wake.current = null
        setTelaLigada(false)
      } else {
        wake.current = await navigator.wakeLock.request('screen')
        wake.current.addEventListener('release', () => setTelaLigada(false))
        setTelaLigada(true)
      }
    } catch {
      avisar('Este aparelho não permite manter a tela ligada.', { erro: true })
    }
  }

  async function executar(fn: () => Promise<void>) {
    try {
      await fn()
    } catch (e) {
      avisar(mensagemErro(e), { erro: true })
      void recarregar()
    }
  }

  const adicionar = (ev: FormEvent) => {
    ev.preventDefault()
    const linhas = novo
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!linhas.length) return
    void executar(async () => {
      const inicio = passos.length ? Math.max(...passos.map((p) => p.ordem)) + 1 : 0
      const criados = ok(
        await supabase
          .from('experimento_passos')
          .insert(linhas.map((d, i) => ({ experimento_id: experimentoId, ordem: inicio + i, descricao: d.slice(0, 2000) })))
          .select('*'),
      ) as Passo[]
      setDados([...passos, ...criados])
      setNovo('')
    })
  }

  const marcar = (p: Passo) =>
    executar(async () => {
      const feito = !p.feito
      setDados(passos.map((x) => (x.id === p.id ? { ...x, feito } : x)))
      ok(await supabase.from('experimento_passos').update({ feito, feito_em: feito ? new Date().toISOString() : null }).eq('id', p.id))
    })

  const mover = (i: number, d: -1 | 1) =>
    executar(async () => {
      const j = i + d
      if (j < 0 || j >= passos.length) return
      const a = passos[i]
      const b = passos[j]
      const nova = [...passos]
      nova[i] = { ...b, ordem: a.ordem }
      nova[j] = { ...a, ordem: b.ordem }
      setDados(nova)
      ok(await supabase.from('experimento_passos').update({ ordem: b.ordem }).eq('id', a.id))
      ok(await supabase.from('experimento_passos').update({ ordem: a.ordem }).eq('id', b.id))
    })

  const salvarEdicao = (p: Passo) => {
    const t = rascunho.trim()
    setEditandoId(null)
    if (!t || t === p.descricao) return
    void executar(async () => {
      setDados(passos.map((x) => (x.id === p.id ? { ...x, descricao: t } : x)))
      ok(await supabase.from('experimento_passos').update({ descricao: t.slice(0, 2000) }).eq('id', p.id))
    })
  }

  const remover = (p: Passo) =>
    executar(async () => {
      setDados(passos.filter((x) => x.id !== p.id))
      ok(await supabase.from('experimento_passos').delete().eq('id', p.id))
      avisar('Passo removido', {
        desfazer: () =>
          executar(async () => {
            const { id: _id, ...resto } = p
            void _id
            ok(await supabase.from('experimento_passos').insert(resto))
            await recarregar()
          }),
      })
    })

  const zerar = () =>
    executar(async () => {
      const marcados = passos.filter((x) => x.feito)
      setDados(passos.map((x) => ({ ...x, feito: false, feito_em: null })))
      ok(await supabase.from('experimento_passos').update({ feito: false, feito_em: null }).eq('experimento_id', experimentoId))
      avisar('Passos desmarcados', {
        desfazer: () =>
          executar(async () => {
            ok(await supabase.from('experimento_passos').update({ feito: true }).in('id', marcados.map((m) => m.id)))
            await recarregar()
          }),
      })
    })

  return (
    <div className="cartao" data-aba-oculta={oculta}>
      <div className="cartao-topo">
        <h2>Passo a passo</h2>
        {passos.length > 0 && (
          <button className="pequeno" aria-pressed={editando} onClick={() => { setEditando(!editando); setEditandoId(null) }}>
            {editando ? <CheckIcon size={16} /> : <PencilSimpleIcon size={16} />} {editando ? 'Pronto' : 'Editar'}
          </button>
        )}
      </div>

      {passos.length > 0 && (
        <div className="progresso">
          <div className="barra" aria-hidden>
            <div style={{ transform: `scaleX(${feitos / passos.length})` }} />
          </div>
          <span className="sutil pequeno" aria-live="polite">
            {feitos} de {passos.length}
          </span>
        </div>
      )}

      {!editando && passos.length > 0 && (
        <div className="acoes" style={{ marginBottom: '0.25rem' }}>
          {podeManterTela && (
            <button className={`pequeno ${telaLigada ? 'botao ativo' : ''}`} aria-pressed={telaLigada} onClick={() => void alternarTela()}>
              <SunIcon size={16} weight={telaLigada ? 'fill' : 'regular'} /> {telaLigada ? 'Tela sempre ligada' : 'Manter tela ligada'}
            </button>
          )}
          {feitos > 0 && (
            <button className="pequeno" onClick={() => void zerar()}>
              Desmarcar todos
            </button>
          )}
        </div>
      )}

      {erro && <p className="erro">{erro}</p>}
      {!dados && !erro && <Esqueleto linhas={4} />}
      {dados && passos.length === 0 && (
        <Vazio>Escreva o protocolo do dia, um passo por linha. Na bancada, você marca cada um ao concluir.</Vazio>
      )}

      <ol className="passos">
        {passos.map((p, i) => (
          <li key={p.id} className={`passo ${p.feito ? 'feito' : ''}`}>
            {editandoId === p.id ? (
              <div className="editor-passo">
                <textarea
                  rows={2}
                  autoFocus
                  aria-label={`Editar passo ${i + 1}`}
                  value={rascunho}
                  onChange={(ev) => setRascunho(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' && !ev.shiftKey) {
                      ev.preventDefault()
                      salvarEdicao(p)
                    }
                    if (ev.key === 'Escape') setEditandoId(null)
                  }}
                />
                <div className="linha-botoes">
                  <button className="pequeno" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </button>
                  <button className="primario pequeno" onClick={() => salvarEdicao(p)}>
                    Salvar passo
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label className="passo-check">
                  <input type="checkbox" checked={p.feito} disabled={editando} onChange={() => void marcar(p)} />
                  <span className="num">{i + 1}</span>
                  <span className="texto">{p.descricao}</span>
                </label>
                {editando && (
                  <div className="passo-edicao">
                    <button className="icone-btn" aria-label={`Subir passo ${i + 1}`} disabled={i === 0} onClick={() => void mover(i, -1)}>
                      <ArrowUpIcon size={18} />
                    </button>
                    <button
                      className="icone-btn"
                      aria-label={`Descer passo ${i + 1}`}
                      disabled={i === passos.length - 1}
                      onClick={() => void mover(i, 1)}
                    >
                      <ArrowDownIcon size={18} />
                    </button>
                    <button
                      className="icone-btn"
                      aria-label={`Editar passo ${i + 1}`}
                      onClick={() => {
                        setEditandoId(p.id)
                        setRascunho(p.descricao)
                      }}
                    >
                      <PencilSimpleIcon size={18} />
                    </button>
                    <button className="icone-btn perigo-btn" aria-label={`Remover passo ${i + 1}`} onClick={() => void remover(p)}>
                      <TrashIcon size={18} />
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ol>

      {(editando || passos.length === 0) && dados && (
        <form onSubmit={adicionar} className="adicionar">
          <label>
            Novos passos
            <textarea
              rows={3}
              placeholder={'Um passo por linha. Ex.:\nAquecer DMEM/F12 a 37 °C\nTripsinizar por 3 min'}
              value={novo}
              onChange={(ev) => setNovo(ev.target.value)}
            />
          </label>
          <div>
            <button disabled={!novo.trim()}>
              <PlusIcon size={16} /> Adicionar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ---------------- Materiais e reagentes ----------------
function Materiais({ experimentoId, oculta }: { experimentoId: string; oculta: string }) {
  const avisar = useAvisos()
  const { dados, erro, setDados, recarregar } = useCarregar(
    async () =>
      ok(await supabase.from('experimento_materiais').select('*').eq('experimento_id', experimentoId).order('created_at')) as Material[],
    [experimentoId],
  )
  const [nome, setNome] = useState('')
  const [qtd, setQtd] = useState('')
  const itens = dados ?? []
  const separados = itens.filter((m) => m.separado).length

  async function adicionar(ev: FormEvent) {
    ev.preventDefault()
    if (!nome.trim()) return
    try {
      const m = ok(
        await supabase
          .from('experimento_materiais')
          .insert({ experimento_id: experimentoId, nome: nome.trim(), quantidade: vazioParaNull(qtd) })
          .select('*')
          .single(),
      ) as Material
      setDados([...itens, m])
      setNome('')
      setQtd('')
    } catch (err) {
      avisar(mensagemErro(err), { erro: true })
    }
  }

  async function marcar(m: Material) {
    setDados(itens.map((x) => (x.id === m.id ? { ...x, separado: !m.separado } : x)))
    const r = await supabase.from('experimento_materiais').update({ separado: !m.separado }).eq('id', m.id)
    if (r.error) {
      avisar(r.error.message, { erro: true })
      void recarregar()
    }
  }

  async function remover(m: Material) {
    setDados(itens.filter((x) => x.id !== m.id))
    const r = await supabase.from('experimento_materiais').delete().eq('id', m.id)
    if (r.error) {
      avisar(r.error.message, { erro: true })
      return void recarregar()
    }
    avisar(`"${m.nome}" removido`, {
      desfazer: async () => {
        const { id: _id, ...resto } = m
        void _id
        await supabase.from('experimento_materiais').insert(resto)
        void recarregar()
      },
    })
  }

  return (
    <div className="cartao" data-aba-oculta={oculta}>
      <div className="cartao-topo">
        <h2>Materiais e reagentes</h2>
        {itens.length > 0 && (
          <span className="sutil pequeno">
            {separados} de {itens.length} separados
          </span>
        )}
      </div>
      {erro && <p className="erro">{erro}</p>}
      {!dados && !erro && <Esqueleto linhas={2} />}
      {dados && itens.length === 0 && <Vazio>Liste o que separar antes de começar. Marque cada item quando estiver na bancada.</Vazio>}
      <ul className="lista">
        {itens.map((m) => (
          <li key={m.id} className={`linha ${m.separado ? 'item-feito' : ''}`}>
            <label className="check" style={{ flex: 1, minWidth: 0 }}>
              <input type="checkbox" checked={m.separado} onChange={() => void marcar(m)} />
              <span className="texto titulo">{m.nome}</span>
            </label>
            {m.quantidade && <span className="sutil pequeno">{m.quantidade}</span>}
            <button className="icone-btn" aria-label={`Remover ${m.nome}`} onClick={() => void remover(m)}>
              <XIcon size={18} />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={adicionar} className="adicionar-linha">
        <input aria-label="Material ou reagente" placeholder="Material ou reagente" maxLength={200} value={nome} onChange={(ev) => setNome(ev.target.value)} />
        <input aria-label="Quantidade" placeholder="Qtd." maxLength={100} className="curto" value={qtd} onChange={(ev) => setQtd(ev.target.value)} />
        <button className="icone-btn" style={{ border: '1px solid var(--borda)', background: 'var(--superficie-2)' }} aria-label="Adicionar material" disabled={!nome.trim()}>
          <PlusIcon size={18} />
        </button>
      </form>
    </div>
  )
}

// ---------------- Protocolos usados ----------------
function ProtocolosVinculados({ experimentoId, oculta }: { experimentoId: string; oculta: string }) {
  const avisar = useAvisos()
  const { dados, erro, recarregar } = useCarregar(async () => {
    const [vinc, todos] = await Promise.all([
      supabase.from('experimento_protocolos').select('protocolo_id').eq('experimento_id', experimentoId),
      supabase.from('protocolos').select('id, titulo, versao, arquivado').order('titulo'),
    ])
    const ids = new Set((ok(vinc) as { protocolo_id: string }[]).map((v) => v.protocolo_id))
    const lista = ok(todos) as Pick<Protocolo, 'id' | 'titulo' | 'versao' | 'arquivado'>[]
    return { usados: lista.filter((p) => ids.has(p.id)), livres: lista.filter((p) => !ids.has(p.id) && !p.arquivado) }
  }, [experimentoId])

  async function vincular(pid: string) {
    if (!pid) return
    const r = await supabase.from('experimento_protocolos').insert({ experimento_id: experimentoId, protocolo_id: pid })
    if (r.error) avisar(r.error.message, { erro: true })
    void recarregar()
  }

  async function desvincular(p: { id: string; titulo: string }) {
    const r = await supabase.from('experimento_protocolos').delete().eq('experimento_id', experimentoId).eq('protocolo_id', p.id)
    if (r.error) avisar(r.error.message, { erro: true })
    else avisar(`"${p.titulo}" desvinculado`, { desfazer: () => vincular(p.id) })
    void recarregar()
  }

  return (
    <div className="cartao" data-aba-oculta={oculta}>
      <div className="cartao-topo">
        <h2>Protocolos usados</h2>
        <Link to="/mestrado/protocolos/novo" className="texto-btn">
          Novo protocolo
        </Link>
      </div>
      {erro && <p className="erro">{erro}</p>}
      {!dados && !erro && <Esqueleto linhas={1} />}
      {dados && dados.usados.length === 0 && <Vazio>Vincule os protocolos que este experimento segue, para consultar na bancada.</Vazio>}
      <ul className="lista">
        {dados?.usados.map((p) => (
          <li key={p.id} className="linha">
            <Link to={`/mestrado/protocolos/${p.id}`} className="corpo">
              <span className="titulo">{p.titulo}</span>
              <span className="sub">Versão {p.versao}</span>
            </Link>
            <button className="icone-btn" aria-label={`Desvincular ${p.titulo}`} onClick={() => void desvincular(p)}>
              <XIcon size={18} />
            </button>
          </li>
        ))}
      </ul>
      {dados && dados.livres.length > 0 && (
        <select
          aria-label="Vincular protocolo"
          value=""
          onChange={(ev) => void vincular(ev.target.value)}
          style={{ marginTop: '0.75rem' }}
        >
          <option value="">Vincular protocolo...</option>
          {dados.livres.map((p) => (
            <option key={p.id} value={p.id}>
              {p.titulo}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
