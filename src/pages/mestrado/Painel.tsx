import { ArrowRightIcon, FlagIcon, PlusIcon } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useAvisos } from '../../components/Avisos'
import { Esqueleto, Vazio } from '../../components/Estados'
import { supabase } from '../../lib/supabase'
import { concluirTarefa } from '../../lib/tarefas'
import { STATUS_EXP, type Experimento, type Tarefa } from '../../lib/types'
import { codigoExp, dataRelativa, estaAtrasada, mensagemErro, ok, useCarregar } from '../../lib/util'

export default function Painel() {
  const avisar = useAvisos()
  const { dados, erro, recarregar, setDados } = useCarregar(async () => {
    const [exps, tarefas] = await Promise.all([
      supabase
        .from('experimentos')
        .select('*')
        .eq('arquivado', false)
        .in('status', ['planejado', 'em_andamento'])
        .order('data_planejada', { ascending: true, nullsFirst: false })
        .limit(12),
      supabase
        .from('tarefas')
        .select('*')
        .eq('area', 'mestrado')
        .eq('status', 'pendente')
        .eq('arquivado', false)
        .order('prazo', { ascending: true, nullsFirst: false })
        .limit(6),
    ])
    const lista = ok(exps) as Experimento[]
    const ativos = lista.filter((e) => e.status === 'em_andamento')
    let progresso: Record<string, { feitos: number; total: number }> = {}
    if (ativos.length) {
      const passos = ok(
        await supabase
          .from('experimento_passos')
          .select('experimento_id, feito')
          .in('experimento_id', ativos.map((e) => e.id)),
      ) as { experimento_id: string; feito: boolean }[]
      progresso = passos.reduce<typeof progresso>((acc, p) => {
        const x = (acc[p.experimento_id] ??= { feitos: 0, total: 0 })
        x.total++
        if (p.feito) x.feitos++
        return acc
      }, {})
    }
    return {
      ativos,
      planejados: lista.filter((e) => e.status === 'planejado').slice(0, 6),
      progresso,
      tarefas: ok(tarefas) as Tarefa[],
    }
  }, [])

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

  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <h1>Mestrado</h1>
        </div>
        <Link to="/mestrado/experimentos/novo" className="botao primario">
          <PlusIcon size={18} weight="bold" /> Experimento
        </Link>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {!dados && !erro && <Esqueleto linhas={4} />}

      {dados && (
        <>
          {dados.ativos.map((e) => {
            const p = dados.progresso[e.id] ?? { feitos: 0, total: 0 }
            return (
              <div key={e.id} className="cartao destaque" style={{ marginBottom: '1rem' }}>
                <span className="rotulo">Em andamento</span>
                <h2>{e.titulo}</h2>
                <div className="meta">
                  <span className="codigo">{codigoExp(e.numero)}</span>
                  {e.modelo_celular && <span>{e.modelo_celular}</span>}
                </div>
                {p.total > 0 && (
                  <div className="progresso">
                    <div className="barra" aria-hidden>
                      <div style={{ transform: `scaleX(${p.feitos / p.total})` }} />
                    </div>
                    <span className="sutil pequeno">
                      {p.feitos} de {p.total} passos
                    </span>
                  </div>
                )}
                <div>
                  <Link to={`/mestrado/experimentos/${e.id}`} className="botao primario">
                    Abrir bancada <ArrowRightIcon size={18} />
                  </Link>
                </div>
              </div>
            )
          })}

          <div className="colunas">
            <div className="cartao">
              <div className="cartao-topo">
                <h2>Próximos experimentos</h2>
                <Link to="/mestrado/experimentos" className="texto-btn">
                  Ver todos
                </Link>
              </div>
              {dados.planejados.length === 0 ? (
                <Vazio
                  acao={
                    <Link to="/mestrado/experimentos/novo" className="botao pequeno">
                      <PlusIcon size={16} /> Planejar experimento
                    </Link>
                  }
                >
                  Nenhum experimento planejado. Planeje o próximo com o passo a passo antes de ir para a bancada.
                </Vazio>
              ) : (
                <ul className="lista">
                  {dados.planejados.map((e) => (
                    <li key={e.id}>
                      <Link to={`/mestrado/experimentos/${e.id}`} className="linha">
                        <div className="corpo">
                          <span className="titulo">{e.titulo}</span>
                          <span className="sub">
                            <span className="codigo">{codigoExp(e.numero)}</span>
                            <span>{dataRelativa(e.data_planejada)}</span>
                            {e.modelo_celular && <span>{e.modelo_celular}</span>}
                          </span>
                        </div>
                        <span className={`selo ${e.status}`}>{STATUS_EXP[e.status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="cartao">
              <div className="cartao-topo">
                <h2>Tarefas</h2>
                <Link to="/mestrado/tarefas" className="texto-btn">
                  Ver todas
                </Link>
              </div>
              {dados.tarefas.length === 0 ? (
                <Vazio
                  acao={
                    <Link to="/mestrado/tarefas" className="botao pequeno">
                      <PlusIcon size={16} /> Adicionar tarefa
                    </Link>
                  }
                >
                  Nada pendente. Leituras, escrita e reuniões com a orientadora aparecem aqui.
                </Vazio>
              ) : (
                <ul className="lista">
                  {dados.tarefas.map((t) => (
                    <li key={t.id} className="linha tarefa">
                      <input
                        type="checkbox"
                        aria-label={`Concluir ${t.titulo}`}
                        checked={false}
                        onChange={() => void concluir(t)}
                      />
                      <div className="corpo">
                        <span className="titulo">{t.titulo}</span>
                        <span className="sub">
                          <span className={estaAtrasada(t.prazo) ? 'atrasada' : ''}>{dataRelativa(t.prazo)}</span>
                          {t.prioridade === 1 && (
                            <span className="prioridade-alta">
                              <FlagIcon size={14} weight="fill" /> Alta
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
        </>
      )}
    </section>
  )
}
