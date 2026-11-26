import { CATEGORIAS_CASA } from '../../lib/types'
import { ListaTarefas } from '../mestrado/Tarefas'

export default function Casa() {
  return (
    <ListaTarefas
      area="casa"
      titulo="Casa"
      subtitulo="Tarefas domésticas"
      categorias={CATEGORIAS_CASA}
      repeticaoPadrao="semanal"
      vazio="Nada pendente em casa. Cadastre as tarefas que se repetem (lavar roupa, compras, contas): ao concluir, a próxima já é agendada."
    />
  )
}
