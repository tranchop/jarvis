import { createClient } from '@supabase/supabase-js'

// Apenas a chave PUBLICÁVEL vai para o site. Ela não dá acesso a nada sozinha:
// todo dado é protegido por RLS e exige login do dono com 2 fatores.
// Nunca coloque aqui a service_role / secret key.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const configurado = Boolean(url && key)

if (key && /^(sb_secret_|eyJ.*c2VydmljZV9yb2xl)/.test(key)) {
  throw new Error('Chave secreta detectada no site. Use apenas a chave publicável.')
}

export const supabase = createClient(url ?? 'https://placeholder.supabase.co', key ?? 'placeholder', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
