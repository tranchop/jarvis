import { BarbellIcon, HeartbeatIcon, HouseLineIcon, WalletIcon } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Esqueleto } from '../../components/Estados'
import { supabase } from '../../lib/supabase'
import type { Remedio } from '../../lib/types'
import { hojeISO, inicioSemana, intervaloMes, mesISO, moeda, nomeMes, ok, useCarregar } from '../../lib/util'

export default function Resumo() {
  const hoje = hojeISO()
  const { dados, erro } = useCarregar(async () => {
    const { inicio, fim } = intervaloMes(mesISO())
    const [fin, rem, tom, tre, casa] = await Promise.all([
      supabase.from('financas').select('tipo, valor').eq('arquivado', false).gte('data', inicio).lte('data', fim),
      supabase.from('saude_remedios').select('*').eq('arquivado', false),
      supabase.from('saude_tomadas').select('id').eq('data', hoje),
      supabase.from('treinos').select('duracao_min').eq('arquivado', false).gte('data', inicioSemana(hoje)),
      supabase.from('tarefas').select('prazo').eq('area', 'casa').eq('status', 'pendente').eq('arquivado', false),
    ])
    const lanc = ok(fin) as { tipo: string; valor: number }[]
    const saidas = lanc.filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0)
    const entradas = lanc.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor), 0)
    const doses = (ok(rem) as Remedio[])
      .filter((r) => r.inicio <= hoje && (!r.fim || r.fim >= hoje))
      .reduce((s, r) => s + r.horarios.length, 0)
    const treinos = ok(tre) as { duracao_min: number | null }[]
    const tarefas = ok(casa) as { prazo: string | null }[]
    return {
      saidas,
      saldo: entradas - saidas,
      doses,
      tomadas: (ok(tom) as unknown[]).length,
      treinos: treinos.length,
      minutos: treinos.reduce((s, t) => s + (t.duracao_min ?? 0), 0),
      casaHoje: tarefas.filter((t) => t.prazo && t.prazo <= hoje).length,
      casaTotal: tarefas.length,
    }
  }, [hoje])

  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <h1>Pessoal</h1>
          <p className="sutil pequeno">Resumo de hoje e do mês</p>
        </div>
      </header>
      {erro && <p className="erro">{erro}</p>}
      {!dados && !erro && <Esqueleto linhas={4} />}
      {dados && (
        <div className="grade-resumo">
          <Link to="/pessoal/financas" className="cartao cartao-link resumo-card">
            <span className="cab">
              <WalletIcon size={20} /> Gastos em {nomeMes(mesISO()).split(' ')[0].toLowerCase()}
            </span>
            <span className="num">{moeda(dados.saidas)}</span>
            <span className={`pequeno ${dados.saldo < 0 ? 'atrasada' : 'sutil'}`}>Saldo do mês {moeda(dados.saldo)}</span>
          </Link>
          <Link to="/pessoal/saude" className="cartao cartao-link resumo-card">
            <span className="cab">
              <HeartbeatIcon size={20} /> Remédios de hoje
            </span>
            <span className="num">{dados.doses ? `${dados.tomadas} de ${dados.doses}` : 'Nenhum'}</span>
            <span className="sutil pequeno">{dados.doses ? (dados.tomadas >= dados.doses ? 'Todas as doses tomadas' : 'doses tomadas') : 'Sem doses programadas'}</span>
          </Link>
          <Link to="/pessoal/treinos" className="cartao cartao-link resumo-card">
            <span className="cab">
              <BarbellIcon size={20} /> Treinos da semana
            </span>
            <span className="num">{dados.treinos}</span>
            <span className="sutil pequeno">{dados.minutos ? `${dados.minutos} minutos no total` : 'Nenhum registrado'}</span>
          </Link>
          <Link to="/pessoal/casa" className="cartao cartao-link resumo-card">
            <span className="cab">
              <HouseLineIcon size={20} /> Casa
            </span>
            <span className="num">{dados.casaHoje}</span>
            <span className="sutil pequeno">
              {dados.casaHoje === 1 ? 'tarefa para hoje' : 'tarefas para hoje'}
              {dados.casaTotal > dados.casaHoje && `, ${dados.casaTotal - dados.casaHoje} depois`}
            </span>
          </Link>
        </div>
      )}
    </section>
  )
}
