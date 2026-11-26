import { useCallback, useEffect, useState } from 'react'

export function hojeISO(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function formatarData(iso: string | null): string {
  if (!iso) return 'Sem data'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const DIA_MS = 86_400_000
function diasAte(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const [ha, hm, hd] = hojeISO().split('-').map(Number)
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / DIA_MS)
}

// "Hoje", "Amanhã", "Ontem", "sex., 28 nov." (ano só se for outro)
export function dataRelativa(iso: string | null, vazio = 'Sem prazo'): string {
  if (!iso) return vazio
  const n = diasAte(iso)
  if (n === 0) return 'Hoje'
  if (n === 1) return 'Amanhã'
  if (n === -1) return 'Ontem'
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dt = new Date(a, m - 1, d)
  const mesmoAno = a === new Date().getFullYear()
  const txt = dt.toLocaleDateString('pt-BR', {
    weekday: Math.abs(n) <= 6 ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: mesmoAno ? undefined : 'numeric',
  })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

// "atualizado hoje", "atualizado ontem", "atualizado em 20/11"
export function atualizadoEm(iso: string): string {
  const r = dataRelativa(iso)
  if (r === 'Hoje' || r === 'Ontem') return `atualizado ${r.toLowerCase()}`
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `atualizado em ${d}/${m}${Number(a) === new Date().getFullYear() ? '' : `/${a}`}`
}

export function estaAtrasada(iso: string | null): boolean {
  return Boolean(iso) && diasAte(iso!) < 0
}

export function somarData(iso: string, r: 'diaria' | 'semanal' | 'mensal'): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  if (r === 'diaria') dt.setUTCDate(dt.getUTCDate() + 1)
  if (r === 'semanal') dt.setUTCDate(dt.getUTCDate() + 7)
  if (r === 'mensal') dt.setUTCMonth(dt.getUTCMonth() + 1)
  return dt.toISOString().slice(0, 10)
}

export function codigoExp(n: number): string {
  return `EXP-${String(n).padStart(3, '0')}`
}

// Só aceita links do Google Drive/Docs (evita links maliciosos tipo javascript:)
export function linkDriveSeguro(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol === 'https:' && (u.hostname === 'drive.google.com' || u.hostname === 'docs.google.com')) return u.href
  } catch {
    /* inválido */
  }
  return null
}

export function vazioParaNull(v: string): string | null {
  const t = v.trim()
  return t === '' ? null : t
}

// Carregamento simples com estado de erro
export function useCarregar<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(fn, deps)
  const recarregar = useCallback(async () => {
    setCarregando(true)
    try {
      setDados(await executar())
      setErro(null)
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregando(false)
    }
  }, [executar])
  useEffect(() => {
    void recarregar()
  }, [recarregar])
  return { dados, erro, carregando, recarregar, setDados }
}

export function mensagemErro(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Erro inesperado.'
}

// Lança se o Supabase devolveu erro
export function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw r.error
  return r.data
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const moeda = (v: number) => BRL.format(v)

// Aceita "25", "25,5", "1.234,56" e "1234.56"
export function lerValor(txt: string): number | null {
  let t = txt.trim().replace(/[R$\s]/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

export function mesISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function intervaloMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

export function somarMes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  return mesISO(new Date(a, m - 1 + n, 1))
}

export function nomeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  const t = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Segunda-feira da semana de uma data (ISO)
export function inicioSemana(iso = hojeISO()): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  const dia = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - dia)
  return dt.toISOString().slice(0, 10)
}

export function horaAgora(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
