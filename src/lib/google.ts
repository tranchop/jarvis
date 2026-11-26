import { supabase } from './supabase'

export interface EventoAgenda {
  id: string
  titulo: string
  inicio: string | null
  fim: string | null
  diaInteiro: boolean
  local: string | null
  agenda: string
  cor: string | null
  link: string | null
}

export interface StatusGoogle {
  conectado: boolean
  email?: string | null
  conectado_em?: string
}

async function chamar<T>(rota: string, corpo: object = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`google-agenda/${rota}`, { body: corpo })
  if (error) throw new Error('Não foi possível falar com a Google Agenda agora.')
  return data as T
}

export async function statusGoogle(): Promise<StatusGoogle> {
  const { data, error } = await supabase.rpc('google_status')
  if (error) throw error
  return data as StatusGoogle
}

export async function conectarGoogle() {
  const { url } = await chamar<{ url: string }>('iniciar')
  // só segue para o domínio oficial de login do Google
  if (!url?.startsWith('https://accounts.google.com/')) throw new Error('Endereço de autorização inválido.')
  window.location.href = url
}

export const desconectarGoogle = () => chamar<{ conectado: false }>('desconectar')

export function eventosGoogle(inicio: Date, fim: Date) {
  return chamar<{ conectado: boolean; erro?: string; eventos: EventoAgenda[] }>('eventos', {
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
  })
}

// Dia local (AAAA-MM-DD) em que o evento começa
export function diaDoEvento(e: EventoAgenda): string {
  if (!e.inicio) return ''
  if (e.diaInteiro) return e.inicio.slice(0, 10)
  const d = new Date(e.inicio)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function horaDoEvento(e: EventoAgenda): string | null {
  if (!e.inicio || e.diaInteiro) return null
  return new Date(e.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
