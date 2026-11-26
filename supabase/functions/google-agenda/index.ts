// Jarvis · Edge Function "google-agenda"
// Lê a Google Agenda do Pedro (somente leitura). O token de atualização fica
// no Supabase Vault; o site nunca vê token nem segredo.
//
// Rotas:
//   POST /iniciar      (dono + 2FA)  -> { url } para autorizar no Google
//   GET  /callback     (Google)      -> guarda o token e volta para o app
//   POST /eventos      (dono + 2FA)  -> { conectado, eventos[] }
//   POST /desconectar  (dono + 2FA)  -> revoga e apaga o token
//
// Segredos (Supabase > Edge Functions > Secrets): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP = 'https://tranchop.github.io/jarvis/'
const ORIGEM_APP = 'https://tranchop.github.io'
const SB_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
const REDIRECT = `${SB_URL}/functions/v1/google-agenda/callback`
const ESCOPO = 'https://www.googleapis.com/auth/calendar.readonly'

const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

const cors = {
  'Access-Control-Allow-Origin': ORIGEM_APP,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  Vary: 'Origin',
}
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const voltar = (resultado: string) =>
  new Response(null, { status: 302, headers: { Location: `${APP}#/conta?google=${encodeURIComponent(resultado)}`, 'Cache-Control': 'no-store' } })

function claims(jwt: string): Record<string, unknown> {
  try {
    const p = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4)))
  } catch {
    return {}
  }
}

// Só o dono, com login em 2 fatores
async function exigirDono(req: Request): Promise<boolean> {
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!jwt) return false
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) return false
  if (claims(jwt).aal !== 'aal2') return false
  const r = await admin.rpc('jarvis_eh_dono', { p_uid: data.user.id })
  return r.data === true
}

function aleatorio(bytes = 32) {
  const b = crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

async function tokenDeAcesso(): Promise<string | null> {
  const { data: refresh } = await admin.rpc('google_ler_token')
  if (!refresh) return null
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh as string, grant_type: 'refresh_token' }),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    if (e.error === 'invalid_grant') await admin.rpc('google_remover') // acesso revogado no Google
    return null
  }
  return (await r.json()).access_token as string
}

interface Agenda { id: string; summary: string; summaryOverride?: string; backgroundColor?: string; selected?: boolean; primary?: boolean }
interface EventoG {
  id: string
  status?: string
  summary?: string
  location?: string
  htmlLink?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

async function eventos(inicio: string, fim: string) {
  const token = await tokenDeAcesso()
  if (!token) return { conectado: false, eventos: [] }
  const h = { Authorization: `Bearer ${token}` }
  const lista = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=50', { headers: h })
  if (!lista.ok) return { conectado: true, erro: 'Não foi possível ler suas agendas.', eventos: [] }
  const agendas = ((await lista.json()).items ?? []) as Agenda[]
  const usadas = agendas.filter((a) => a.selected || a.primary).slice(0, 20)
  const resultados = await Promise.all(
    usadas.map(async (a) => {
      const q = new URLSearchParams({ timeMin: inicio, timeMax: fim, singleEvents: 'true', orderBy: 'startTime', maxResults: '100' })
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(a.id)}/events?${q}`, { headers: h })
      if (!r.ok) return []
      const itens = ((await r.json()).items ?? []) as EventoG[]
      return itens
        .filter((e) => e.status !== 'cancelled')
        .map((e) => ({
          id: `${a.id}:${e.id}`,
          titulo: e.summary ?? '(sem título)',
          inicio: e.start?.dateTime ?? e.start?.date ?? null,
          fim: e.end?.dateTime ?? e.end?.date ?? null,
          diaInteiro: Boolean(e.start?.date && !e.start?.dateTime),
          local: e.location ?? null,
          agenda: a.summaryOverride ?? a.summary,
          cor: a.backgroundColor ?? null,
          link: e.htmlLink?.startsWith('https://www.google.com/calendar/') ? e.htmlLink : null,
        }))
    }),
  )
  const todos = resultados.flat().sort((x, y) => String(x.inicio).localeCompare(String(y.inicio)))
  return { conectado: true, eventos: todos }
}

Deno.serve(async (req) => {
  const rota = new URL(req.url).pathname.split('/').pop()
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (!CLIENT_ID || !CLIENT_SECRET) return json({ erro: 'Integração não configurada no servidor.' }, 503)

  try {
    if (rota === 'callback' && req.method === 'GET') {
      const u = new URL(req.url)
      const code = u.searchParams.get('code')
      const estado = u.searchParams.get('state') ?? ''
      if (u.searchParams.get('error')) return voltar('cancelado')
      const { data: valido } = await admin.rpc('google_consumir_estado', { p_estado: estado })
      if (!code || valido !== true) return voltar('expirado')
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
      })
      if (!r.ok) return voltar('erro')
      const tok = await r.json()
      if (!tok.refresh_token || !String(tok.scope ?? '').includes(ESCOPO)) return voltar('sem_permissao')
      const prim = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', { headers: { Authorization: `Bearer ${tok.access_token}` } })
      const email = prim.ok ? ((await prim.json()).id as string) : null
      const salvo = await admin.rpc('google_salvar_token', { p_refresh: tok.refresh_token, p_email: email })
      if (salvo.error) return voltar('erro')
      return voltar('ok')
    }

    if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405)
    if (!(await exigirDono(req))) return json({ erro: 'Acesso negado' }, 401)

    if (rota === 'iniciar') {
      const estado = aleatorio(32)
      const s = await admin.rpc('google_salvar_estado', { p_estado: estado })
      if (s.error) return json({ erro: 'Falha ao iniciar' }, 500)
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.search = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT,
        response_type: 'code',
        scope: ESCOPO,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'false',
        state: estado,
      }).toString()
      return json({ url: url.toString() })
    }

    if (rota === 'eventos') {
      const corpo = await req.json().catch(() => ({}))
      const inicio = new Date(corpo.inicio)
      const fim = new Date(corpo.fim)
      if (isNaN(+inicio) || isNaN(+fim) || fim <= inicio || +fim - +inicio > 62 * 86400_000) return json({ erro: 'Intervalo inválido' }, 400)
      return json(await eventos(inicio.toISOString(), fim.toISOString()))
    }

    if (rota === 'desconectar') {
      const { data: refresh } = await admin.rpc('google_ler_token')
      if (refresh) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh as string)}`, { method: 'POST' }).catch(() => {})
      await admin.rpc('google_remover')
      return json({ conectado: false })
    }

    return json({ erro: 'Rota desconhecida' }, 404)
  } catch (e) {
    console.error('google-agenda', e instanceof Error ? e.message : 'erro')
    return json({ erro: 'Erro interno' }, 500)
  }
})
