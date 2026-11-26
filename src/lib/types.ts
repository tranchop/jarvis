export type StatusExperimento = 'planejado' | 'em_andamento' | 'concluido' | 'cancelado'

export const STATUS_EXP: Record<StatusExperimento, string> = {
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export interface Experimento {
  id: string
  numero: number
  titulo: string
  objetivo: string | null
  modelo_celular: string | null
  data_planejada: string | null
  data_execucao: string | null
  status: StatusExperimento
  link_drive: string | null
  observacoes: string | null
  resultados: string | null
  arquivado: boolean
  created_at: string
  updated_at: string
}

export interface Passo {
  id: string
  experimento_id: string
  ordem: number
  descricao: string
  duracao_min: number | null
  feito: boolean
  feito_em: string | null
}

export interface Material {
  id: string
  experimento_id: string
  nome: string
  quantidade: string | null
  observacao: string | null
  separado: boolean
}

export interface Protocolo {
  id: string
  titulo: string
  categoria: string | null
  conteudo: string
  versao: number
  arquivado: boolean
  updated_at: string
}

export type Recorrencia = 'diaria' | 'semanal' | 'mensal'

export interface Tarefa {
  id: string
  titulo: string
  descricao: string | null
  area: string
  categoria: string | null
  prazo: string | null
  prioridade: 1 | 2 | 3
  status: 'pendente' | 'feita' | 'cancelada'
  recorrencia: Recorrencia | null
  origem_id: string | null
  experimento_id: string | null
  concluida_em: string | null
  arquivado: boolean
}

export const MODELOS_CELULARES = ['SH-SY5Y', 'U87-MG', 'Cocultura SH-SY5Y + U87-MG', 'Esferoide 3D', 'MDA-MB-231', 'MCF10A']
export const CATEGORIAS_TAREFA = ['Leitura', 'Escrita', 'Reunião', 'Bancada', 'Disciplina', 'Burocracia', 'Outro']

// ---------------- Pessoal ----------------
export interface Lancamento {
  id: string
  tipo: 'entrada' | 'saida'
  valor: number
  categoria: string
  data: string
  descricao: string | null
  arquivado: boolean
}

export const CATEGORIAS_SAIDA = ['Alimentação', 'Transporte', 'Contas fixas', 'Lazer', 'Estudo', 'Saúde', 'Casa', 'Outros']
export const CATEGORIAS_ENTRADA = ['Aulas de inglês', 'Bolsa', 'Outros']

export interface Consulta {
  id: string
  tipo: 'consulta' | 'exame'
  especialidade: string
  data_hora: string
  local: string | null
  retorno: string | null
  status: 'agendada' | 'realizada' | 'cancelada'
  observacoes: string | null
  arquivado: boolean
}

export interface Remedio {
  id: string
  nome: string
  dose: string | null
  horarios: string[]
  inicio: string
  fim: string | null
  observacoes: string | null
  arquivado: boolean
}

export interface Tomada {
  id: string
  remedio_id: string
  data: string
  horario: string
  tomado_em: string
}

export interface Treino {
  id: string
  data: string
  tipo: string
  duracao_min: number | null
  observacao: string | null
  arquivado: boolean
}

export const TIPOS_TREINO = ['Musculação', 'Corrida', 'Caminhada', 'Bike', 'Natação', 'Funcional']
export const CATEGORIAS_CASA = ['Limpeza', 'Roupa', 'Cozinha', 'Compras', 'Contas', 'Manutenção']
