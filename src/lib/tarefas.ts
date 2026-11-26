import { supabase } from './supabase'
import type { Tarefa } from './types'
import { hojeISO, ok, somarData } from './util'

// Conclui a tarefa; se for recorrente, cria a próxima ocorrência.
// Devolve uma função que desfaz tudo.
export async function concluirTarefa(t: Tarefa): Promise<() => Promise<void>> {
  ok(await supabase.from('tarefas').update({ status: 'feita', concluida_em: new Date().toISOString() }).eq('id', t.id))
  let proximaId: string | null = null
  if (t.recorrencia) {
    const p = ok(
      await supabase
        .from('tarefas')
        .insert({
          titulo: t.titulo,
          descricao: t.descricao,
          area: t.area,
          categoria: t.categoria,
          prioridade: t.prioridade,
          recorrencia: t.recorrencia,
          prazo: somarData(t.prazo ?? hojeISO(), t.recorrencia),
          origem_id: t.origem_id ?? t.id,
          experimento_id: t.experimento_id,
        })
        .select('id')
        .single(),
    ) as { id: string }
    proximaId = p.id
  }
  return async () => {
    ok(await supabase.from('tarefas').update({ status: 'pendente', concluida_em: null }).eq('id', t.id))
    // a ocorrência criada é arquivada (nunca apagada)
    if (proximaId) ok(await supabase.from('tarefas').update({ arquivado: true }).eq('id', proximaId))
  }
}
