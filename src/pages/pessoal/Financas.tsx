import { ArchiveIcon, CaretLeftIcon, CaretRightIcon, PlusIcon } from '@phosphor-icons/react'
import { useMemo, useState, type FormEvent } from 'react'
import { useAvisos } from '../../components/Avisos'
import { Esqueleto, Vazio } from '../../components/Estados'
import { supabase } from '../../lib/supabase'
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, type Lancamento } from '../../lib/types'
import {
  dataRelativa,
  hojeISO,
  intervaloMes,
  lerValor,
  mensagemErro,
  mesISO,
  moeda,
  nomeMes,
  ok,
  somarMes,
  useCarregar,
  vazioParaNull,
} from '../../lib/util'

export default function Financas() {
  const avisar = useAvisos()
  const [mes, setMes] = useState(mesISO())
  const { dados, erro, setDados, recarregar } = useCarregar(async () => {
    const { inicio, fim } = intervaloMes(mes)
    return ok(
      await supabase
        .from('financas')
        .select('*')
        .eq('arquivado', false)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false }),
    ) as Lancamento[]
  }, [mes])

  const [tipo, setTipo] = useState<'saida' | 'entrada'>('saida')
  const [valor, setValor] = useState('')
  const [categoria, setCategoria] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(hojeISO())
  const [erroForm, setErroForm] = useState<string | null>(null)
  const categorias = tipo === 'saida' ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA

  const resumo = useMemo(() => {
    const l = dados ?? []
    const entradas = l.filter((x) => x.tipo === 'entrada').reduce((s, x) => s + Number(x.valor), 0)
    const saidas = l.filter((x) => x.tipo === 'saida').reduce((s, x) => s + Number(x.valor), 0)
    const porCat = new Map<string, number>()
    for (const x of l.filter((x) => x.tipo === 'saida')) porCat.set(x.categoria, (porCat.get(x.categoria) ?? 0) + Number(x.valor))
    const cats = [...porCat.entries()].sort((a, b) => b[1] - a[1])
    const porDia = new Map<string, Lancamento[]>()
    for (const x of l) porDia.set(x.data, [...(porDia.get(x.data) ?? []), x])
    return { entradas, saidas, saldo: entradas - saidas, cats, dias: [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0])) }
  }, [dados])

  async function lancar(e: FormEvent) {
    e.preventDefault()
    setErroForm(null)
    const v = lerValor(valor)
    if (!v) return setErroForm('Informe um valor maior que zero, ex.: 25,90.')
    if (!categoria) return setErroForm('Escolha uma categoria.')
    try {
      const novo = ok(
        await supabase
          .from('financas')
          .insert({ tipo, valor: v, categoria, descricao: vazioParaNull(descricao), data: data || hojeISO() })
          .select('*')
          .single(),
      ) as Lancamento
      if (novo.data.startsWith(mes)) setDados([novo, ...(dados ?? [])].sort((a, b) => b.data.localeCompare(a.data)))
      setValor('')
      setDescricao('')
      setData(hojeISO())
      avisar(`${tipo === 'saida' ? 'Gasto' : 'Entrada'} de ${moeda(v)} lançado`)
    } catch (err) {
      setErroForm(mensagemErro(err))
    }
  }

  async function arquivar(l: Lancamento) {
    setDados((dados ?? []).filter((x) => x.id !== l.id))
    const r = await supabase.from('financas').update({ arquivado: true }).eq('id', l.id)
    if (r.error) {
      avisar(r.error.message, { erro: true })
      return void recarregar()
    }
    avisar('Lançamento removido', {
      desfazer: async () => {
        await supabase.from('financas').update({ arquivado: false }).eq('id', l.id)
        void recarregar()
      },
    })
  }

  const ehMesAtual = mes === mesISO()

  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <h1>Finanças</h1>
          <p className="sutil pequeno">Pessoal</p>
        </div>
        <div className="seletor-mes" role="group" aria-label="Mês">
          <button className="icone-btn" aria-label="Mês anterior" onClick={() => setMes(somarMes(mes, -1))}>
            <CaretLeftIcon size={20} />
          </button>
          <span>{nomeMes(mes)}</span>
          <button className="icone-btn" aria-label="Próximo mês" disabled={ehMesAtual} onClick={() => setMes(somarMes(mes, 1))}>
            <CaretRightIcon size={20} />
          </button>
        </div>
      </header>

      <div className="cartao numeros" style={{ marginBottom: '1rem' }}>
        <div>
          <span className="rotulo-num">Entradas</span>
          <span className="num ok-texto">{moeda(resumo.entradas)}</span>
        </div>
        <div>
          <span className="rotulo-num">Saídas</span>
          <span className="num">{moeda(resumo.saidas)}</span>
        </div>
        <div>
          <span className="rotulo-num">Saldo</span>
          <span className={`num ${resumo.saldo < 0 ? 'atrasada' : ''}`}>{moeda(resumo.saldo)}</span>
        </div>
      </div>

      <div className="detalhe-grade">
        <div className="pilha">
          <form className="cartao formulario" onSubmit={lancar} noValidate>
            <div className="cartao-topo" style={{ marginBottom: 0 }}>
              <h2>Novo lançamento</h2>
              <div className="segmentos" role="group" aria-label="Tipo">
                <button type="button" aria-pressed={tipo === 'saida'} onClick={() => { setTipo('saida'); setCategoria('') }}>
                  Gasto
                </button>
                <button type="button" aria-pressed={tipo === 'entrada'} onClick={() => { setTipo('entrada'); setCategoria('') }}>
                  Entrada
                </button>
              </div>
            </div>
            <div className="duas sempre-duas">
              <label>
                Valor
                <div className="campo-moeda">
                  <span aria-hidden>R$</span>
                  <input inputMode="decimal" autoComplete="off" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
                </div>
              </label>
              <label>
                Data
                <input type="date" value={data} max={hojeISO()} onChange={(e) => setData(e.target.value)} />
              </label>
            </div>
            <div className="grupo-campo">
              <span className="rotulo-campo">Categoria</span>
              <div className="chips" role="group" aria-label="Categoria">
                {categorias.map((c) => (
                  <button key={c} type="button" className="chip" aria-pressed={categoria === c} onClick={() => setCategoria(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <label>
              Descrição (opcional)
              <input maxLength={300} placeholder={tipo === 'saida' ? 'Ex.: almoço no bandejão' : 'Ex.: repasse de novembro'} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </label>
            {erroForm && (
              <p className="erro" role="alert">
                {erroForm}
              </p>
            )}
            <div>
              <button className="primario">
                <PlusIcon size={18} weight="bold" /> Lançar {tipo === 'saida' ? 'gasto' : 'entrada'}
              </button>
            </div>
          </form>

          {resumo.cats.length > 0 && (
            <div className="cartao">
              <h2 style={{ marginBottom: '0.75rem' }}>Gastos por categoria</h2>
              <ul className="lista-barras">
                {resumo.cats.map(([c, v]) => (
                  <li key={c}>
                    <div className="topo-barra">
                      <span>{c}</span>
                      <span className="sutil">
                        {moeda(v)} <span className="pequeno">({Math.round((v / resumo.saidas) * 100)}%)</span>
                      </span>
                    </div>
                    <div className="barra-cat" aria-hidden>
                      <div style={{ transform: `scaleX(${v / resumo.cats[0][1]})` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="cartao">
          <h2 style={{ marginBottom: '0.25rem' }}>Lançamentos</h2>
          {erro && <p className="erro">{erro}</p>}
          {!dados && !erro && <Esqueleto linhas={4} />}
          {dados && dados.length === 0 && (
            <Vazio>
              {ehMesAtual
                ? 'Nenhum lançamento neste mês. Registre cada gasto na hora, leva 10 segundos e mostra para onde o dinheiro vai.'
                : 'Nenhum lançamento neste mês.'}
            </Vazio>
          )}
          {resumo.dias.map(([dia, itens]) => (
            <div key={dia} className="dia">
              <p className="dia-rotulo">{dataRelativa(dia)}</p>
              <ul className="lista">
                {itens.map((l) => (
                  <li key={l.id} className="linha">
                    <div className="corpo">
                      <span className="titulo">{l.descricao || l.categoria}</span>
                      {l.descricao && <span className="sub">{l.categoria}</span>}
                    </div>
                    <span className={`valor ${l.tipo === 'entrada' ? 'ok-texto' : ''}`}>
                      {l.tipo === 'entrada' ? '+' : '-'} {moeda(Number(l.valor))}
                    </span>
                    <button className="icone-btn" aria-label={`Remover lançamento ${l.descricao || l.categoria}`} title="Remover" onClick={() => void arquivar(l)}>
                      <ArchiveIcon size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
