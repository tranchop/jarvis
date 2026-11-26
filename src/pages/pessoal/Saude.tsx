import { ArchiveIcon, CheckIcon, ClockIcon, MapPinIcon, PlusIcon, StopIcon, XIcon } from '@phosphor-icons/react'
import { useMemo, useState, type FormEvent } from 'react'
import { useAvisos } from '../../components/Avisos'
import { Esqueleto, Vazio } from '../../components/Estados'
import { supabase } from '../../lib/supabase'
import type { Consulta, Remedio, Tomada } from '../../lib/types'
import { dataRelativa, hojeISO, mensagemErro, ok, useCarregar, vazioParaNull } from '../../lib/util'

type Aba = 'hoje' | 'consultas' | 'remedios'

function emUso(r: Remedio, dia: string) {
  return !r.arquivado && r.inicio <= dia && (!r.fim || r.fim >= dia)
}

function horaDe(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function diaDe(iso: string) {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export default function Saude() {
  const [aba, setAba] = useState<Aba>('hoje')
  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <h1>Saúde</h1>
          <p className="sutil pequeno">Pessoal</p>
        </div>
      </header>
      <div className="segmentos abas-fixas" role="tablist" aria-label="Seções de saúde" style={{ marginBottom: '1rem' }}>
        {(
          [
            ['hoje', 'Hoje'],
            ['consultas', 'Consultas e exames'],
            ['remedios', 'Remédios'],
          ] as const
        ).map(([v, r]) => (
          <button key={v} role="tab" aria-selected={aba === v} aria-pressed={aba === v} onClick={() => setAba(v)}>
            {r}
          </button>
        ))}
      </div>
      {aba === 'hoje' && <Hoje irParaRemedios={() => setAba('remedios')} />}
      {aba === 'consultas' && <Consultas />}
      {aba === 'remedios' && <Remedios />}
    </section>
  )
}

// ---------------- Doses de hoje ----------------
function Hoje({ irParaRemedios }: { irParaRemedios: () => void }) {
  const avisar = useAvisos()
  const hoje = hojeISO()
  const { dados, erro, setDados, recarregar } = useCarregar(async () => {
    const [rem, tom, cons] = await Promise.all([
      supabase.from('saude_remedios').select('*').eq('arquivado', false).order('nome'),
      supabase.from('saude_tomadas').select('*').eq('data', hoje),
      supabase
        .from('saude_consultas')
        .select('*')
        .eq('arquivado', false)
        .eq('status', 'agendada')
        .gte('data_hora', new Date(Date.now() - 6 * 3600_000).toISOString())
        .lte('data_hora', new Date(Date.now() + 7 * 86400_000).toISOString())
        .order('data_hora'),
    ])
    return {
      remedios: (ok(rem) as Remedio[]).filter((r) => emUso(r, hoje)),
      tomadas: ok(tom) as Tomada[],
      consultas: ok(cons) as Consulta[],
    }
  }, [hoje])

  const doses = useMemo(() => {
    if (!dados) return []
    return dados.remedios
      .flatMap((r) => r.horarios.map((h) => ({ r, h, t: dados.tomadas.find((t) => t.remedio_id === r.id && t.horario === h) })))
      .sort((a, b) => a.h.localeCompare(b.h))
  }, [dados])
  const tomadas = doses.filter((d) => d.t).length

  async function alternar(r: Remedio, h: string, t?: Tomada) {
    if (!dados) return
    try {
      if (t) {
        setDados({ ...dados, tomadas: dados.tomadas.filter((x) => x.id !== t.id) })
        ok(await supabase.from('saude_tomadas').delete().eq('id', t.id))
      } else {
        const nova = ok(await supabase.from('saude_tomadas').insert({ remedio_id: r.id, horario: h, data: hoje }).select('*').single()) as Tomada
        setDados({ ...dados, tomadas: [...dados.tomadas, nova] })
      }
    } catch (e) {
      avisar(mensagemErro(e), { erro: true })
      void recarregar()
    }
  }

  if (erro) return <p className="erro">{erro}</p>
  if (!dados) return <Esqueleto linhas={3} />

  return (
    <div className="colunas">
      <div className="cartao">
        <div className="cartao-topo">
          <h2>Remédios de hoje</h2>
          {doses.length > 0 && (
            <span className="sutil pequeno">
              {tomadas} de {doses.length} tomados
            </span>
          )}
        </div>
        {doses.length === 0 ? (
          <Vazio
            acao={
              <button className="pequeno" onClick={irParaRemedios}>
                <PlusIcon size={16} /> Cadastrar remédio
              </button>
            }
          >
            Nenhum remédio com horário para hoje. Cadastre os que você usa para marcar cada dose.
          </Vazio>
        ) : (
          <ul className="lista">
            {doses.map(({ r, h, t }) => (
              <li key={`${r.id}-${h}`}>
                <label className={`dose ${t ? 'tomada' : ''}`}>
                  <input type="checkbox" checked={Boolean(t)} onChange={() => void alternar(r, h, t)} />
                  <span className="hora">{h}</span>
                  <span className="corpo">
                    <span className="nome-dose titulo">{r.nome}</span>
                    {r.dose && <span className="sub">{r.dose}</span>}
                  </span>
                  {t && <span className="sutil pequeno">às {horaDe(t.tomado_em)}</span>}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="cartao">
        <h2 style={{ marginBottom: '0.25rem' }}>Próximos 7 dias</h2>
        {dados.consultas.length === 0 ? (
          <Vazio>Nenhuma consulta ou exame agendado para os próximos dias.</Vazio>
        ) : (
          <ul className="lista">
            {dados.consultas.map((c) => (
              <li key={c.id} className="linha">
                <div className="corpo">
                  <span className="titulo">{c.especialidade}</span>
                  <span className="sub">
                    <span>
                      {dataRelativa(diaDe(c.data_hora))}, {horaDe(c.data_hora)}
                    </span>
                    {c.local && <span>{c.local}</span>}
                  </span>
                </div>
                <span className="selo neutro">{c.tipo === 'exame' ? 'Exame' : 'Consulta'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------- Consultas e exames ----------------
function Consultas() {
  const avisar = useAvisos()
  const { dados, erro, recarregar } = useCarregar(
    async () =>
      ok(await supabase.from('saude_consultas').select('*').eq('arquivado', false).order('data_hora', { ascending: true })) as Consulta[],
    [],
  )
  const [abrir, setAbrir] = useState(false)
  const [tipo, setTipo] = useState<'consulta' | 'exame'>('consulta')
  const [esp, setEsp] = useState('')
  const [dia, setDia] = useState('')
  const [hora, setHora] = useState('')
  const [local, setLocal] = useState('')
  const [retorno, setRetorno] = useState('')
  const [obs, setObs] = useState('')
  const [erroForm, setErroForm] = useState<string | null>(null)

  const agora = Date.now()
  const proximas = (dados ?? []).filter((c) => c.status === 'agendada' && new Date(c.data_hora).getTime() >= agora - 6 * 3600_000)
  const passadas = (dados ?? [])
    .filter((c) => !proximas.includes(c))
    .reverse()
    .slice(0, 15)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErroForm(null)
    if (!esp.trim()) return setErroForm(tipo === 'exame' ? 'Informe qual exame.' : 'Informe a especialidade ou o médico.')
    if (!dia || !hora) return setErroForm('Informe data e horário.')
    try {
      ok(
        await supabase.from('saude_consultas').insert({
          tipo,
          especialidade: esp.trim(),
          data_hora: new Date(`${dia}T${hora}`).toISOString(),
          local: vazioParaNull(local),
          retorno: retorno || null,
          observacoes: vazioParaNull(obs),
        }),
      )
      setEsp('')
      setDia('')
      setHora('')
      setLocal('')
      setRetorno('')
      setObs('')
      setAbrir(false)
      avisar(tipo === 'exame' ? 'Exame agendado' : 'Consulta agendada')
      void recarregar()
    } catch (err) {
      setErroForm(mensagemErro(err))
    }
  }

  async function mudar(c: Consulta, campos: Partial<Consulta>, msg: string) {
    const r = await supabase.from('saude_consultas').update(campos).eq('id', c.id)
    if (r.error) return avisar(r.error.message, { erro: true })
    avisar(msg, {
      desfazer: async () => {
        await supabase.from('saude_consultas').update({ status: c.status, arquivado: c.arquivado }).eq('id', c.id)
        void recarregar()
      },
    })
    void recarregar()
  }

  return (
    <div className="pilha">
      {abrir ? (
        <form className="cartao formulario" onSubmit={salvar} noValidate>
          <div className="cartao-topo" style={{ marginBottom: 0 }}>
            <h2>Agendar</h2>
            <div className="segmentos" role="group" aria-label="Tipo">
              <button type="button" aria-pressed={tipo === 'consulta'} onClick={() => setTipo('consulta')}>
                Consulta
              </button>
              <button type="button" aria-pressed={tipo === 'exame'} onClick={() => setTipo('exame')}>
                Exame
              </button>
            </div>
          </div>
          <label>
            {tipo === 'exame' ? 'Exame' : 'Especialidade ou médico'}
            <input maxLength={120} placeholder={tipo === 'exame' ? 'Ex.: hemograma' : 'Ex.: clínico geral'} value={esp} onChange={(e) => setEsp(e.target.value)} />
          </label>
          <div className="duas">
            <label>
              Data
              <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
            </label>
            <label>
              Horário
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </label>
            <label>
              Local
              <input maxLength={200} value={local} onChange={(e) => setLocal(e.target.value)} />
            </label>
            <label>
              Retorno previsto (opcional)
              <input type="date" value={retorno} onChange={(e) => setRetorno(e.target.value)} />
            </label>
          </div>
          <label>
            Observações (opcional)
            <textarea rows={2} maxLength={5000} placeholder="Ex.: levar exames anteriores, jejum de 8 h" value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          {erroForm && (
            <p className="erro" role="alert">
              {erroForm}
            </p>
          )}
          <div className="acoes">
            <button className="primario">Salvar</button>
            <button type="button" onClick={() => setAbrir(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button className="primario" onClick={() => setAbrir(true)}>
            <PlusIcon size={18} weight="bold" /> Agendar consulta ou exame
          </button>
        </div>
      )}

      <div className="cartao">
        <h2 style={{ marginBottom: '0.25rem' }}>Próximas</h2>
        {erro && <p className="erro">{erro}</p>}
        {!dados && !erro && <Esqueleto linhas={2} />}
        {dados && proximas.length === 0 && <Vazio>Nada agendado.</Vazio>}
        <ul className="lista">
          {proximas.map((c) => (
            <li key={c.id} className="linha">
              <div className="corpo">
                <span className="titulo">
                  {c.especialidade} <span className="selo neutro">{c.tipo === 'exame' ? 'Exame' : 'Consulta'}</span>
                </span>
                <span className="sub">
                  <span className="icone-texto">
                    <ClockIcon size={14} /> {dataRelativa(diaDe(c.data_hora))}, {horaDe(c.data_hora)}
                  </span>
                  {c.local && (
                    <span className="icone-texto">
                      <MapPinIcon size={14} /> {c.local}
                    </span>
                  )}
                  {c.retorno && <span>Retorno {dataRelativa(c.retorno).toLowerCase()}</span>}
                </span>
                {c.observacoes && <span className="sub">{c.observacoes}</span>}
              </div>
              <button className="icone-btn" aria-label={`Marcar ${c.especialidade} como realizada`} title="Realizada" onClick={() => void mudar(c, { status: 'realizada' }, 'Marcada como realizada')}>
                <CheckIcon size={18} />
              </button>
              <button className="icone-btn" aria-label={`Cancelar ${c.especialidade}`} title="Cancelar" onClick={() => void mudar(c, { status: 'cancelada' }, 'Cancelada')}>
                <XIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {passadas.length > 0 && (
        <div className="cartao">
          <h2 style={{ marginBottom: '0.25rem' }}>Histórico</h2>
          <ul className="lista">
            {passadas.map((c) => (
              <li key={c.id} className="linha">
                <div className="corpo">
                  <span className="titulo">{c.especialidade}</span>
                  <span className="sub">
                    <span>{new Date(c.data_hora).toLocaleDateString('pt-BR')}</span>
                    <span>{c.status === 'realizada' ? 'Realizada' : c.status === 'cancelada' ? 'Cancelada' : 'Não marcada'}</span>
                  </span>
                </div>
                <button className="icone-btn" aria-label={`Arquivar ${c.especialidade}`} title="Arquivar" onClick={() => void mudar(c, { arquivado: true }, 'Arquivada')}>
                  <ArchiveIcon size={18} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------- Remédios ----------------
function Remedios() {
  const avisar = useAvisos()
  const hoje = hojeISO()
  const { dados, erro, recarregar } = useCarregar(
    async () => ok(await supabase.from('saude_remedios').select('*').eq('arquivado', false).order('nome')) as Remedio[],
    [],
  )
  const [abrir, setAbrir] = useState(false)
  const [nome, setNome] = useState('')
  const [dose, setDose] = useState('')
  const [horarios, setHorarios] = useState<string[]>(['08:00'])
  const [novoHorario, setNovoHorario] = useState('')
  const [fim, setFim] = useState('')
  const [erroForm, setErroForm] = useState<string | null>(null)

  const emUsoLista = (dados ?? []).filter((r) => emUso(r, hoje))
  const encerrados = (dados ?? []).filter((r) => !emUso(r, hoje))

  function addHorario() {
    if (!/^\d{2}:\d{2}$/.test(novoHorario) || horarios.includes(novoHorario)) return
    setHorarios([...horarios, novoHorario].sort())
    setNovoHorario('')
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErroForm(null)
    if (!nome.trim()) return setErroForm('Informe o nome do remédio.')
    if (!horarios.length) return setErroForm('Adicione pelo menos um horário.')
    try {
      ok(
        await supabase.from('saude_remedios').insert({ nome: nome.trim(), dose: vazioParaNull(dose), horarios, inicio: hoje, fim: fim || null }),
      )
      setNome('')
      setDose('')
      setHorarios(['08:00'])
      setFim('')
      setAbrir(false)
      avisar('Remédio cadastrado')
      void recarregar()
    } catch (err) {
      setErroForm(mensagemErro(err))
    }
  }

  async function encerrar(r: Remedio) {
    // a dose de hoje continua na lista; a partir de amanhã, não aparece mais
    const res = await supabase.from('saude_remedios').update({ fim: hoje < r.inicio ? r.inicio : hoje }).eq('id', r.id)
    if (res.error) return avisar(res.error.message, { erro: true })
    avisar(`${r.nome} encerrado a partir de amanhã`, {
      desfazer: async () => {
        await supabase.from('saude_remedios').update({ fim: r.fim }).eq('id', r.id)
        void recarregar()
      },
    })
    void recarregar()
  }

  async function arquivar(r: Remedio) {
    const res = await supabase.from('saude_remedios').update({ arquivado: true }).eq('id', r.id)
    if (res.error) return avisar(res.error.message, { erro: true })
    avisar(`${r.nome} arquivado`, {
      desfazer: async () => {
        await supabase.from('saude_remedios').update({ arquivado: false }).eq('id', r.id)
        void recarregar()
      },
    })
    void recarregar()
  }

  return (
    <div className="pilha">
      {abrir ? (
        <form className="cartao formulario" onSubmit={salvar} noValidate>
          <h2>Novo remédio</h2>
          <div className="duas">
            <label>
              Nome
              <input maxLength={120} placeholder="Ex.: Vitamina D" value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label>
              Dose (opcional)
              <input maxLength={120} placeholder="Ex.: 1 cápsula, 2000 UI" value={dose} onChange={(e) => setDose(e.target.value)} />
            </label>
          </div>
          <div className="grupo-campo">
            <span className="rotulo-campo">Horários</span>
            <div className="horarios-edit">
              {horarios.map((h) => (
                <span key={h} className="chip-hora">
                  {h}
                  <button type="button" aria-label={`Remover horário ${h}`} onClick={() => setHorarios(horarios.filter((x) => x !== h))}>
                    <XIcon size={14} />
                  </button>
                </span>
              ))}
              <input type="time" aria-label="Novo horário" style={{ minHeight: 36 }} value={novoHorario} onChange={(e) => setNovoHorario(e.target.value)} />
              <button type="button" className="pequeno" disabled={!novoHorario} onClick={addHorario}>
                <PlusIcon size={16} /> Horário
              </button>
            </div>
          </div>
          <label style={{ maxWidth: 260 }}>
            Até quando (opcional)
            <input type="date" min={hoje} value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
          {erroForm && (
            <p className="erro" role="alert">
              {erroForm}
            </p>
          )}
          <div className="acoes">
            <button className="primario">Salvar remédio</button>
            <button type="button" onClick={() => setAbrir(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button className="primario" onClick={() => setAbrir(true)}>
            <PlusIcon size={18} weight="bold" /> Cadastrar remédio
          </button>
        </div>
      )}

      <div className="cartao">
        <h2 style={{ marginBottom: '0.25rem' }}>Em uso</h2>
        {erro && <p className="erro">{erro}</p>}
        {!dados && !erro && <Esqueleto linhas={2} />}
        {dados && emUsoLista.length === 0 && <Vazio>Nenhum remédio em uso.</Vazio>}
        <ul className="lista">
          {emUsoLista.map((r) => (
            <li key={r.id} className="linha">
              <div className="corpo">
                <span className="titulo">
                  {r.nome}
                  {r.dose && <span className="sutil"> {r.dose}</span>}
                </span>
                <span className="sub">
                  <span>{r.horarios.join(', ')}</span>
                  {r.fim && <span>{r.fim === hoje ? 'Último dia hoje' : `Até ${dataRelativa(r.fim).toLowerCase()}`}</span>}
                </span>
              </div>
              {r.fim !== hoje && (
                <button className="pequeno" onClick={() => void encerrar(r)} title="Parar de tomar a partir de amanhã">
                  <StopIcon size={16} /> Encerrar
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {encerrados.length > 0 && (
        <div className="cartao">
          <h2 style={{ marginBottom: '0.25rem' }}>Encerrados</h2>
          <ul className="lista">
            {encerrados.map((r) => (
              <li key={r.id} className="linha">
                <div className="corpo">
                  <span className="titulo">{r.nome}</span>
                  <span className="sub">{r.fim ? `Até ${new Date(r.fim + 'T12:00').toLocaleDateString('pt-BR')}` : `Começa ${dataRelativa(r.inicio).toLowerCase()}`}</span>
                </div>
                <button className="icone-btn" aria-label={`Arquivar ${r.nome}`} title="Arquivar" onClick={() => void arquivar(r)}>
                  <ArchiveIcon size={18} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
