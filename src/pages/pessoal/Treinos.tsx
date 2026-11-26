import { ArchiveIcon, CheckIcon, PlusIcon } from '@phosphor-icons/react'
import { useMemo, useState, type FormEvent } from 'react'
import { useAvisos } from '../../components/Avisos'
import { Esqueleto, Vazio } from '../../components/Estados'
import { supabase } from '../../lib/supabase'
import { TIPOS_TREINO, type Treino } from '../../lib/types'
import { dataRelativa, hojeISO, inicioSemana, mensagemErro, ok, useCarregar, vazioParaNull } from '../../lib/util'

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const DURACOES = [30, 45, 60, 90]

export default function Treinos() {
  const avisar = useAvisos()
  const hoje = hojeISO()
  const segunda = inicioSemana(hoje)
  const { dados, erro, setDados, recarregar } = useCarregar(
    async () =>
      ok(
        await supabase
          .from('treinos')
          .select('*')
          .eq('arquivado', false)
          .gte('data', somarDias(segunda, -49))
          .order('data', { ascending: false })
          .order('created_at', { ascending: false }),
      ) as Treino[],
    [segunda],
  )

  const [tipo, setTipo] = useState('')
  const [outro, setOutro] = useState('')
  const [duracao, setDuracao] = useState('')
  const [data, setData] = useState(hoje)
  const [obs, setObs] = useState('')
  const [erroForm, setErroForm] = useState<string | null>(null)

  const semana = useMemo(() => {
    const l = (dados ?? []).filter((t) => t.data >= segunda)
    const dias = DIAS.map((d, i) => {
      const iso = somarDias(segunda, i)
      return { d, iso, treinou: l.some((t) => t.data === iso) }
    })
    return { qtd: l.length, minutos: l.reduce((s, t) => s + (t.duracao_min ?? 0), 0), dias }
  }, [dados, segunda])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErroForm(null)
    const t = tipo === 'Outro' ? outro.trim() : tipo
    if (!t) return setErroForm('Escolha o tipo de treino.')
    const min = duracao ? Number(duracao) : null
    if (min !== null && (!Number.isInteger(min) || min < 1 || min > 1440)) return setErroForm('Duração em minutos, entre 1 e 1440.')
    try {
      const novo = ok(
        await supabase.from('treinos').insert({ tipo: t, duracao_min: min, data: data || hoje, observacao: vazioParaNull(obs) }).select('*').single(),
      ) as Treino
      setDados([novo, ...(dados ?? [])].sort((a, b) => b.data.localeCompare(a.data)))
      setObs('')
      setData(hoje)
      avisar('Treino registrado')
    } catch (err) {
      setErroForm(mensagemErro(err))
    }
  }

  async function arquivar(t: Treino) {
    setDados((dados ?? []).filter((x) => x.id !== t.id))
    const r = await supabase.from('treinos').update({ arquivado: true }).eq('id', t.id)
    if (r.error) {
      avisar(r.error.message, { erro: true })
      return void recarregar()
    }
    avisar('Treino removido', {
      desfazer: async () => {
        await supabase.from('treinos').update({ arquivado: false }).eq('id', t.id)
        void recarregar()
      },
    })
  }

  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <h1>Treinos</h1>
          <p className="sutil pequeno">Pessoal</p>
        </div>
      </header>

      <div className="cartao" style={{ marginBottom: '1rem' }}>
        <div className="cartao-topo" style={{ marginBottom: 0 }}>
          <h2>Esta semana</h2>
          <span className="sutil pequeno">
            {semana.qtd} {semana.qtd === 1 ? 'treino' : 'treinos'}
            {semana.minutos > 0 && `, ${semana.minutos} min`}
          </span>
        </div>
        <div className="semana">
          {semana.dias.map((d) => (
            <div key={d.iso}>
              <span className={`marca-dia ${d.treinou ? 'treinou' : ''}`} aria-label={`${d.d}: ${d.treinou ? 'treinou' : 'sem treino'}`}>
                {d.treinou && <CheckIcon size={18} weight="bold" />}
              </span>
              <span className={d.iso === hoje ? 'hoje' : ''}>{d.d}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="detalhe-grade">
        <form className="cartao formulario" onSubmit={salvar} noValidate>
          <h2>Registrar treino</h2>
          <div className="grupo-campo">
            <span className="rotulo-campo">Tipo</span>
            <div className="chips" role="group" aria-label="Tipo de treino">
              {[...TIPOS_TREINO, 'Outro'].map((t) => (
                <button key={t} type="button" className="chip" aria-pressed={tipo === t} onClick={() => setTipo(t)}>
                  {t}
                </button>
              ))}
            </div>
            {tipo === 'Outro' && <input aria-label="Qual treino" placeholder="Qual treino?" maxLength={60} value={outro} onChange={(e) => setOutro(e.target.value)} />}
          </div>
          <div className="grupo-campo">
            <span className="rotulo-campo">Duração (min)</span>
            <div className="chips" role="group" aria-label="Duração">
              {DURACOES.map((m) => (
                <button key={m} type="button" className="chip" aria-pressed={duracao === String(m)} onClick={() => setDuracao(duracao === String(m) ? '' : String(m))}>
                  {m}
                </button>
              ))}
              <input
                inputMode="numeric"
                aria-label="Outra duração em minutos"
                placeholder="Outra"
                className="chip"
                style={{ minHeight: 36 }}
                value={DURACOES.includes(Number(duracao)) ? '' : duracao}
                onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div className="duas">
            <label>
              Data
              <input type="date" max={hoje} value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label>
              Observação (opcional)
              <input maxLength={2000} placeholder="Ex.: treino A, 5 km" value={obs} onChange={(e) => setObs(e.target.value)} />
            </label>
          </div>
          {erroForm && (
            <p className="erro" role="alert">
              {erroForm}
            </p>
          )}
          <div>
            <button className="primario">
              <PlusIcon size={18} weight="bold" /> Registrar
            </button>
          </div>
        </form>

        <div className="cartao">
          <h2 style={{ marginBottom: '0.25rem' }}>Últimas 8 semanas</h2>
          {erro && <p className="erro">{erro}</p>}
          {!dados && !erro && <Esqueleto linhas={3} />}
          {dados && dados.length === 0 && <Vazio>Nenhum treino registrado ainda. Marque cada treino para ver a constância da semana.</Vazio>}
          <ul className="lista">
            {(dados ?? []).map((t) => (
              <li key={t.id} className="linha">
                <div className="corpo">
                  <span className="titulo">{t.tipo}</span>
                  <span className="sub">
                    <span>{dataRelativa(t.data)}</span>
                    {t.duracao_min && <span>{t.duracao_min} min</span>}
                    {t.observacao && <span>{t.observacao}</span>}
                  </span>
                </div>
                <button className="icone-btn" aria-label={`Remover treino de ${t.tipo}`} title="Remover" onClick={() => void arquivar(t)}>
                  <ArchiveIcon size={18} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function somarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}
