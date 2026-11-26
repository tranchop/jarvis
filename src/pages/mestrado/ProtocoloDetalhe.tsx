import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Protocolo } from '../../lib/types'
import { codigoExp, formatarData, mensagemErro, ok, useCarregar, vazioParaNull } from '../../lib/util'

export default function ProtocoloDetalhe() {
  const { id } = useParams()
  const novo = id === 'novo'
  const navigate = useNavigate()
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
    return {
      p: ok(p) as Protocolo,
      usos: (ok(usos) as unknown as { experimentos: { id: string; numero: number; titulo: string } | null }[])
        .map((u) => u.experimentos)
        .filter((x): x is { id: string; numero: number; titulo: string } => Boolean(x)),
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
    setSalvando(true)
    const linha = { titulo: titulo.trim(), categoria: vazioParaNull(categoria), conteudo }
    try {
      if (novo) {
        const r = ok(await supabase.from('protocolos').insert(linha).select('id').single()) as { id: string }
        navigate(`/mestrado/protocolos/${r.id}`, { replace: true })
      } else {
        ok(await supabase.from('protocolos').update(linha).eq('id', id!))
        await prot.recarregar()
        setEditando(false)
      }
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function arquivar(valor: boolean) {
    if (valor && !confirm('Arquivar este protocolo? Nada é apagado.')) return
    try {
      ok(await supabase.from('protocolos').update({ arquivado: valor }).eq('id', id!))
      await prot.recarregar()
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  if (prot.erro) return <p className="erro">{prot.erro}</p>
  if (!novo && !prot.dados) return <p className="sutil">Carregando…</p>
  const p = prot.dados?.p

  return (
    <section>
      <header className="cabecalho">
        <div>
          <Link to="/mestrado/protocolos" className="link pequeno">
            ← Protocolos
          </Link>
          <h1>{novo ? 'Novo protocolo' : p!.titulo}</h1>
          {p && (
            <p className="sutil pequeno">
              {p.categoria ?? 'Sem categoria'} · versão {p.versao} · atualizado em {formatarData(p.updated_at)}
              {p.arquivado && ' · arquivado'}
            </p>
          )}
        </div>
        {!novo && !editando && (
          <div className="acoes">
            <button className="botao primario" onClick={() => setEditando(true)}>
              Editar
            </button>
            <button className="botao" onClick={() => void arquivar(!p!.arquivado)}>
              {p!.arquivado ? 'Desarquivar' : 'Arquivar'}
            </button>
          </div>
        )}
      </header>
      {erro && <p className="erro">{erro}</p>}

      {editando ? (
        <form className="cartao formulario" onSubmit={salvar}>
          <div className="duas">
            <label>
              Título
              <input required maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label>
              Categoria
              <input
                list="cats"
                maxLength={60}
                placeholder="Cultura, viabilidade, molecular…"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              />
              <datalist id="cats">
                {['Cultura celular', 'Viabilidade', 'Estresse oxidativo', 'Molecular', 'Microscopia', 'Preparo de soluções'].map(
                  (c) => (
                    <option key={c} value={c} />
                  ),
                )}
              </datalist>
            </label>
          </div>
          <label>
            Conteúdo
            <textarea
              rows={18}
              maxLength={100000}
              className="mono"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
            />
          </label>
          {!novo && <p className="sutil pequeno">Ao salvar uma mudança no conteúdo, a versão sobe e a anterior fica guardada.</p>}
          <div className="linha-acoes">
            <button className="primario" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            {!novo && (
              <button type="button" className="botao" onClick={() => setEditando(false)}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="colunas detalhe">
          <article className="cartao texto-protocolo">{p!.conteudo || <span className="sutil">Sem conteúdo.</span>}</article>
          <div className="cartao">
            <h2>Usado em</h2>
            {prot.dados!.usos.length === 0 && <p className="sutil">Nenhum experimento.</p>}
            <ul className="lista">
              {prot.dados!.usos.map((u) => (
                <li key={u.id}>
                  <Link to={`/mestrado/experimentos/${u.id}`} className="linha-lista">
                    <span className="codigo">{codigoExp(u.numero)}</span>
                    <span className="cresce">{u.titulo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
