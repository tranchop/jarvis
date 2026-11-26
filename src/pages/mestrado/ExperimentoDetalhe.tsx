import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { codigoExp, linkDriveSeguro, mensagemErro, ok, useCarregar, vazioParaNull } from '../../lib/util'

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

export default function ExperimentoDetalhe() {
  const { id } = useParams()
  const novo = id === 'novo'
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(FORM_VAZIO)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const exp = useCarregar(async () => {
    if (novo || !id) return null
    return ok(await supabase.from('experimentos').select('*').eq('id', id).single()) as Experimento
  }, [id])

  useEffect(() => {
    setForm(exp.dados ? paraForm(exp.dados) : FORM_VAZIO)
  }, [exp.dados])

  function campo<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setMsg(null)
    if (form.link_drive.trim() && !linkDriveSeguro(form.link_drive.trim())) {
      setErro('O link precisa ser do Google Drive (https://drive.google.com/…).')
      return
    }
    setSalvando(true)
    try {
      if (novo) {
        const criado = ok(await supabase.from('experimentos').insert(paraBanco(form)).select('id').single()) as {
          id: string
        }
        navigate(`/mestrado/experimentos/${criado.id}`, { replace: true })
      } else {
        const atualizado = ok(
          await supabase.from('experimentos').update(paraBanco(form)).eq('id', id!).select('*').single(),
        ) as Experimento
        exp.setDados(atualizado)
        setMsg('Salvo.')
      }
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function arquivar(valor: boolean) {
    if (valor && !confirm('Arquivar este experimento? Ele some das listas, mas nada é apagado.')) return
    try {
      const r = ok(
        await supabase.from('experimentos').update({ arquivado: valor }).eq('id', id!).select('*').single(),
      ) as Experimento
      exp.setDados(r)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  async function duplicar() {
    if (!exp.dados) return
    try {
      const base = paraBanco(paraForm(exp.dados))
      const novoExp = ok(
        await supabase
          .from('experimentos')
          .insert({ ...base, titulo: `${base.titulo} (cópia)`, status: 'planejado', data_execucao: null, resultados: null })
          .select('id')
          .single(),
      ) as { id: string }
      const [passos, mats, prots] = await Promise.all([
        supabase.from('experimento_passos').select('ordem, descricao, duracao_min').eq('experimento_id', id!),
        supabase.from('experimento_materiais').select('nome, quantidade, observacao').eq('experimento_id', id!),
        supabase.from('experimento_protocolos').select('protocolo_id').eq('experimento_id', id!),
      ])
      const comId = <T extends object>(l: T[]) => l.map((x) => ({ ...x, experimento_id: novoExp.id }))
      const p = ok(passos) as object[]
      const m = ok(mats) as object[]
      const pr = ok(prots) as object[]
      if (p.length) ok(await supabase.from('experimento_passos').insert(comId(p)))
      if (m.length) ok(await supabase.from('experimento_materiais').insert(comId(m)))
      if (pr.length) ok(await supabase.from('experimento_protocolos').insert(comId(pr)))
      navigate(`/mestrado/experimentos/${novoExp.id}`)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  if (exp.erro) return <p className="erro">{exp.erro}</p>
  if (!novo && !exp.dados) return <p className="sutil">Carregando…</p>
  const link = linkDriveSeguro(exp.dados?.link_drive ?? null)

  return (
    <section>
      <header className="cabecalho">
        <div>
          <Link to="/mestrado/experimentos" className="link pequeno">
            ← Experimentos
          </Link>
          <h1>{novo ? 'Novo experimento' : `${codigoExp(exp.dados!.numero)} · ${exp.dados!.titulo}`}</h1>
          {exp.dados?.arquivado && <span className="etiqueta">Arquivado</span>}
        </div>
        {!novo && (
          <div className="acoes">
            {link && (
              <a className="botao" href={link} target="_blank" rel="noopener noreferrer">
                Resultados no Drive ↗
              </a>
            )}
            <button className="botao" onClick={() => void duplicar()}>
              Duplicar
            </button>
            <button className="botao" onClick={() => void arquivar(!exp.dados!.arquivado)}>
              {exp.dados!.arquivado ? 'Desarquivar' : 'Arquivar'}
            </button>
          </div>
        )}
      </header>

      {erro && <p className="erro">{erro}</p>}

      <div className={novo ? '' : 'colunas detalhe'}>
        <form className="cartao formulario" onSubmit={salvar}>
          <h2>Dados</h2>
          <label>
            Título
            <input required maxLength={200} value={form.titulo} onChange={(e) => campo('titulo', e.target.value)} />
          </label>
          <label>
            Objetivo
            <textarea rows={3} maxLength={5000} value={form.objetivo} onChange={(e) => campo('objetivo', e.target.value)} />
          </label>
          <div className="duas">
            <label>
              Modelo celular
              <input
                list="modelos"
                maxLength={120}
                value={form.modelo_celular}
                onChange={(e) => campo('modelo_celular', e.target.value)}
              />
              <datalist id="modelos">
                {MODELOS_CELULARES.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <label>
              Status
              <select value={form.status} onChange={(e) => campo('status', e.target.value as StatusExperimento)}>
                {Object.entries(STATUS_EXP).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data planejada
              <input type="date" value={form.data_planejada} onChange={(e) => campo('data_planejada', e.target.value)} />
            </label>
            <label>
              Data de execução
              <input type="date" value={form.data_execucao} onChange={(e) => campo('data_execucao', e.target.value)} />
            </label>
          </div>
          <label>
            Pasta de resultados (Google Drive)
            <input
              type="url"
              placeholder="https://drive.google.com/…"
              value={form.link_drive}
              onChange={(e) => campo('link_drive', e.target.value)}
            />
          </label>
          {!novo && (
            <>
              <label>
                Observações
                <textarea
                  rows={3}
                  maxLength={20000}
                  value={form.observacoes}
                  onChange={(e) => campo('observacoes', e.target.value)}
                />
              </label>
              <label>
                Resultados / conclusões
                <textarea
                  rows={4}
                  maxLength={20000}
                  value={form.resultados}
                  onChange={(e) => campo('resultados', e.target.value)}
                />
              </label>
            </>
          )}
          <div className="linha-acoes">
            <button className="primario" disabled={salvando}>
              {salvando ? 'Salvando…' : novo ? 'Criar e montar passo a passo' : 'Salvar'}
            </button>
            {msg && <span className="sucesso">{msg}</span>}
          </div>
        </form>

        {!novo && id && (
          <div className="pilha">
            <Bancada experimentoId={id} />
            <Materiais experimentoId={id} />
            <ProtocolosVinculados experimentoId={id} />
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------- Passo a passo (modo bancada) ----------------
function Bancada({ experimentoId }: { experimentoId: string }) {
  const { dados, erro, setDados } = useCarregar(
    async () =>
      ok(
        await supabase.from('experimento_passos').select('*').eq('experimento_id', experimentoId).order('ordem'),
      ) as Passo[],
    [experimentoId],
  )
  const [novo, setNovo] = useState('')
  const [falha, setFalha] = useState<string | null>(null)
  const [telaLigada, setTelaLigada] = useState(false)
  const wake = useRef<WakeLockSentinel | null>(null)

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
      } else if ('wakeLock' in navigator) {
        wake.current = await navigator.wakeLock.request('screen')
        wake.current.addEventListener('release', () => setTelaLigada(false))
        setTelaLigada(true)
      }
    } catch {
      setFalha('Este aparelho não permite manter a tela ligada.')
    }
  }

  const passos = dados ?? []
  const feitos = passos.filter((p) => p.feito).length

  async function executar(fn: () => Promise<void>) {
    setFalha(null)
    try {
      await fn()
    } catch (e) {
      setFalha(mensagemErro(e))
    }
  }

  const adicionar = (e: FormEvent) => {
    e.preventDefault()
    const linhas = novo
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!linhas.length) return
    void executar(async () => {
      const base = passos.length ? Math.max(...passos.map((p) => p.ordem)) + 1 : 0
      const criados = ok(
        await supabase
          .from('experimento_passos')
          .insert(linhas.map((d, i) => ({ experimento_id: experimentoId, ordem: base + i, descricao: d.slice(0, 2000) })))
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
      ok(
        await supabase
          .from('experimento_passos')
          .update({ feito, feito_em: feito ? new Date().toISOString() : null })
          .eq('id', p.id),
      )
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

  const editar = (p: Passo) => {
    const t = prompt('Editar passo:', p.descricao)
    if (t === null || !t.trim()) return
    void executar(async () => {
      ok(await supabase.from('experimento_passos').update({ descricao: t.trim().slice(0, 2000) }).eq('id', p.id))
      setDados(passos.map((x) => (x.id === p.id ? { ...x, descricao: t.trim() } : x)))
    })
  }

  const remover = (p: Passo) => {
    if (!confirm(`Remover o passo "${p.descricao.slice(0, 60)}"?`)) return
    void executar(async () => {
      ok(await supabase.from('experimento_passos').delete().eq('id', p.id))
      setDados(passos.filter((x) => x.id !== p.id))
    })
  }

  const zerar = () => {
    if (!confirm('Desmarcar todos os passos?')) return
    void executar(async () => {
      ok(
        await supabase
          .from('experimento_passos')
          .update({ feito: false, feito_em: null })
          .eq('experimento_id', experimentoId),
      )
      setDados(passos.map((x) => ({ ...x, feito: false, feito_em: null })))
    })
  }

  return (
    <div className="cartao">
      <div className="linha-topo">
        <h2>Passo a passo</h2>
        <span className="sutil pequeno">
          {feitos}/{passos.length}
        </span>
      </div>
      {passos.length > 0 && (
        <div className="progresso" aria-hidden>
          <div style={{ width: `${(feitos / passos.length) * 100}%` }} />
        </div>
      )}
      <div className="linha-acoes">
        <button type="button" className={`botao pequeno ${telaLigada ? 'ativo' : ''}`} onClick={() => void alternarTela()}>
          {telaLigada ? '☀ Tela fica ligada' : '☀ Manter tela ligada'}
        </button>
        {feitos > 0 && (
          <button type="button" className="botao pequeno" onClick={zerar}>
            Desmarcar tudo
          </button>
        )}
      </div>
      {(erro || falha) && <p className="erro">{erro ?? falha}</p>}
      <ol className="passos">
        {passos.map((p, i) => (
          <li key={p.id} className={p.feito ? 'feito' : ''}>
            <label className="check-grande">
              <input type="checkbox" checked={p.feito} onChange={() => void marcar(p)} />
              <span className="num">{i + 1}</span>
              <span className="texto">{p.descricao}</span>
            </label>
            <div className="mini-acoes">
              <button type="button" aria-label="Subir" onClick={() => void mover(i, -1)}>
                ↑
              </button>
              <button type="button" aria-label="Descer" onClick={() => void mover(i, 1)}>
                ↓
              </button>
              <button type="button" aria-label="Editar" onClick={() => editar(p)}>
                ✎
              </button>
              <button type="button" aria-label="Remover" onClick={() => remover(p)}>
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>
      <form onSubmit={adicionar} className="adicionar">
        <textarea
          rows={2}
          placeholder="Novo passo (cole vários, um por linha)"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
        />
        <button className="botao">Adicionar</button>
      </form>
    </div>
  )
}

// ---------------- Materiais e reagentes ----------------
function Materiais({ experimentoId }: { experimentoId: string }) {
  const { dados, erro, setDados } = useCarregar(
    async () =>
      ok(
        await supabase.from('experimento_materiais').select('*').eq('experimento_id', experimentoId).order('created_at'),
      ) as Material[],
    [experimentoId],
  )
  const [nome, setNome] = useState('')
  const [qtd, setQtd] = useState('')
  const [falha, setFalha] = useState<string | null>(null)
  const itens = dados ?? []

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setFalha(null)
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
      setFalha(mensagemErro(err))
    }
  }

  async function marcar(m: Material) {
    setDados(itens.map((x) => (x.id === m.id ? { ...x, separado: !m.separado } : x)))
    const r = await supabase.from('experimento_materiais').update({ separado: !m.separado }).eq('id', m.id)
    if (r.error) setFalha(r.error.message)
  }

  async function remover(m: Material) {
    if (!confirm(`Remover "${m.nome}"?`)) return
    const r = await supabase.from('experimento_materiais').delete().eq('id', m.id)
    if (r.error) setFalha(r.error.message)
    else setDados(itens.filter((x) => x.id !== m.id))
  }

  return (
    <div className="cartao">
      <h2>Materiais e reagentes</h2>
      {(erro || falha) && <p className="erro">{erro ?? falha}</p>}
      <ul className="lista">
        {itens.map((m) => (
          <li key={m.id} className={`linha-lista ${m.separado ? 'feito' : ''}`}>
            <label className="check">
              <input type="checkbox" checked={m.separado} onChange={() => void marcar(m)} />
              <span className="cresce">{m.nome}</span>
            </label>
            <span className="sutil pequeno">{m.quantidade}</span>
            <button type="button" className="icone-btn" aria-label="Remover" onClick={() => void remover(m)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={adicionar} className="adicionar linha">
        <input placeholder="Material / reagente" maxLength={200} value={nome} onChange={(e) => setNome(e.target.value)} />
        <input placeholder="Qtd." maxLength={100} className="curto" value={qtd} onChange={(e) => setQtd(e.target.value)} />
        <button className="botao">+</button>
      </form>
    </div>
  )
}

// ---------------- Protocolos usados ----------------
function ProtocolosVinculados({ experimentoId }: { experimentoId: string }) {
  const { dados, erro, recarregar } = useCarregar(async () => {
    const [vinc, todos] = await Promise.all([
      supabase.from('experimento_protocolos').select('protocolo_id').eq('experimento_id', experimentoId),
      supabase.from('protocolos').select('id, titulo, versao, arquivado').order('titulo'),
    ])
    const ids = new Set((ok(vinc) as { protocolo_id: string }[]).map((v) => v.protocolo_id))
    const lista = ok(todos) as Pick<Protocolo, 'id' | 'titulo' | 'versao' | 'arquivado'>[]
    return { usados: lista.filter((p) => ids.has(p.id)), livres: lista.filter((p) => !ids.has(p.id) && !p.arquivado) }
  }, [experimentoId])
  const [sel, setSel] = useState('')
  const [falha, setFalha] = useState<string | null>(null)

  async function vincular() {
    if (!sel) return
    const r = await supabase.from('experimento_protocolos').insert({ experimento_id: experimentoId, protocolo_id: sel })
    if (r.error) setFalha(r.error.message)
    setSel('')
    void recarregar()
  }

  async function desvincular(pid: string) {
    const r = await supabase
      .from('experimento_protocolos')
      .delete()
      .eq('experimento_id', experimentoId)
      .eq('protocolo_id', pid)
    if (r.error) setFalha(r.error.message)
    void recarregar()
  }

  return (
    <div className="cartao">
      <h2>Protocolos</h2>
      {(erro || falha) && <p className="erro">{erro ?? falha}</p>}
      <ul className="lista">
        {dados?.usados.map((p) => (
          <li key={p.id} className="linha-lista">
            <Link to={`/mestrado/protocolos/${p.id}`} className="cresce">
              {p.titulo} <span className="sutil pequeno">v{p.versao}</span>
            </Link>
            <button type="button" className="icone-btn" aria-label="Desvincular" onClick={() => void desvincular(p.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="adicionar linha">
        <select value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">Vincular protocolo…</option>
          {dados?.livres.map((p) => (
            <option key={p.id} value={p.id}>
              {p.titulo}
            </option>
          ))}
        </select>
        <button type="button" className="botao" onClick={() => void vincular()} disabled={!sel}>
          +
        </button>
      </div>
      <Link to="/mestrado/protocolos/novo" className="link pequeno">
        Criar protocolo
      </Link>
    </div>
  )
}
