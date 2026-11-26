import { ArchiveIcon, ArrowLeftIcon, PencilSimpleIcon } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAvisos } from '../../components/Avisos'
import { Esqueleto, Vazio } from '../../components/Estados'
import { supabase } from '../../lib/supabase'
import type { Protocolo } from '../../lib/types'
import { atualizadoEm, codigoExp, mensagemErro, ok, useCarregar, vazioParaNull } from '../../lib/util'

const CATEGORIAS = ['Cultura celular', 'Viabilidade', 'Estresse oxidativo', 'Molecular', 'Microscopia', 'Preparo de soluções']

export default function ProtocoloDetalhe() {
  const { id } = useParams()
  const novo = id === 'novo'
  const navigate = useNavigate()
  const avisar = useAvisos()
  const [editando, setEditando] = useState(novo)
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const prot = useCarregar(async () => {
    if (novo || !id) return null
    const [p, usos] = await Promise.all([
      supabase.from('protocolos').select('*').eq('id', id).single(),
      supabase.from('experimento_protocolos').select('experimentos(id, numero, titulo)').eq('protocolo_id', id),
    ])
    type Uso = { id: string; numero: number; titulo: string }
    return {
      p: ok(p) as Protocolo,
      usos: (ok(usos) as unknown as { experimentos: Uso | null }[]).map((u) => u.experimentos).filter((x): x is Uso => Boolean(x)),
    }
  }, [id])

  useEffect(() => {
    if (prot.dados) {
      setTitulo(prot.dados.p.titulo)
      setCategoria(prot.dados.p.categoria ?? '')
      setConteudo(prot.dados.p.conteudo)
    }
  }, [prot.dados])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!titulo.trim()) return setErro('Dê um título ao protocolo.')
    setSalvando(true)
    const linha = { titulo: titulo.trim(), categoria: vazioParaNull(categoria), conteudo }
    try {
      if (novo) {
        const r = ok(await supabase.from('protocolos').insert(linha).select('id').single()) as { id: string }
        navigate(`/mestrado/protocolos/${r.id}`, { replace: true })
        avisar('Protocolo criado')
      } else {
        ok(await supabase.from('protocolos').update(linha).eq('id', id!))
        await prot.recarregar()
        setEditando(false)
        avisar('Protocolo salvo. A versão anterior ficou guardada.')
      }
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function arquivar(valor: boolean) {
    try {
      ok(await supabase.from('protocolos').update({ arquivado: valor }).eq('id', id!))
      await prot.recarregar()
      avisar(valor ? 'Protocolo arquivado' : 'Protocolo desarquivado', { desfazer: () => arquivar(!valor) })
    } catch (err) {
      avisar(mensagemErro(err), { erro: true })
    }
  }

  if (prot.erro) return <p className="erro">{prot.erro}</p>
  if (!novo && !prot.dados) return <Esqueleto linhas={4} />
  const p = prot.dados?.p

  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <Link to="/mestrado/protocolos" className="voltar">
            <ArrowLeftIcon size={16} /> Protocolos
          </Link>
          <h1>{novo ? 'Novo protocolo' : p!.titulo}</h1>
          {p && (
            <div className="meta">
              <span>{p.categoria ?? 'Sem categoria'}</span>
              <span>Versão {p.versao}</span>
              <span className="primeira-maiuscula">{atualizadoEm(p.updated_at)}</span>
              {p.arquivado && <span className="selo neutro">Arquivado</span>}
            </div>
          )}
        </div>
        {!novo && !editando && (
          <div className="acoes">
            <button className="primario" onClick={() => setEditando(true)}>
              <PencilSimpleIcon size={18} /> Editar
            </button>
            <button className="icone-btn" aria-label={p!.arquivado ? 'Desarquivar' : 'Arquivar'} title={p!.arquivado ? 'Desarquivar' : 'Arquivar'} onClick={() => void arquivar(!p!.arquivado)}>
              <ArchiveIcon size={22} />
            </button>
          </div>
        )}
      </header>

      {editando ? (
        <form className="cartao formulario" onSubmit={salvar} style={{ maxWidth: 860 }} noValidate>
          <div className="duas">
            <label>
              Título
              <input required maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label>
              Categoria
              <input list="cats" maxLength={60} placeholder="Ex.: Viabilidade" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
              <datalist id="cats">
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>
          <label>
            Conteúdo
            <textarea rows={18} maxLength={100000} className="mono" value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
          </label>
          {!novo && <p className="sutil pequeno">Ao mudar o conteúdo, a versão sobe e a anterior fica guardada no histórico.</p>}
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
          <div className="acoes">
            <button className="primario" disabled={salvando}>
              {salvando ? 'Salvando...' : novo ? 'Criar protocolo' : 'Salvar'}
            </button>
            {!novo && (
              <button
                type="button"
                onClick={() => {
                  setEditando(false)
                  setTitulo(p!.titulo)
                  setCategoria(p!.categoria ?? '')
                  setConteudo(p!.conteudo)
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="detalhe-grade">
          <article className="cartao">
            {p!.conteudo ? <div className="texto-protocolo">{p!.conteudo}</div> : <Vazio>Sem conteúdo ainda. Toque em Editar para escrever.</Vazio>}
          </article>
          <div className="cartao">
            <h2 style={{ marginBottom: '0.25rem' }}>Usado em</h2>
            {prot.dados!.usos.length === 0 ? (
              <Vazio>Nenhum experimento usa este protocolo ainda.</Vazio>
            ) : (
              <ul className="lista">
                {prot.dados!.usos.map((u) => (
                  <li key={u.id}>
                    <Link to={`/mestrado/experimentos/${u.id}`} className="linha">
                      <div className="corpo">
                        <span className="titulo">{u.titulo}</span>
                        <span className="sub">
                          <span className="codigo">{codigoExp(u.numero)}</span>
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
