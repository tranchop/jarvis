import { useCallback, useEffect, useState } from 'react'

export function hojeISO(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
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
