import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

type Nivel = 'carregando' | 'deslogado' | 'precisa_2fa' | 'ok'

interface AuthCtx {
  nivel: Nivel
  session: Session | null
  atualizar: () => Promise<void>
  sair: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

// Sai sozinho depois de 2 h sem uso (também ao reabrir o app depois disso).
const LIMITE_INATIVIDADE_MS = 2 * 60 * 60 * 1000
const CHAVE_ATIVIDADE = 'jarvis:ultima-atividade'

function marcarAtividade() {
  try {
    localStorage.setItem(CHAVE_ATIVIDADE, String(Date.now()))
  } catch {
    /* modo privado: ignora */
  }
}

function inativoDemais(): boolean {
  try {
    const v = Number(localStorage.getItem(CHAVE_ATIVIDADE) ?? 0)
    return v > 0 && Date.now() - v > LIMITE_INATIVIDADE_MS
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [nivel, setNivel] = useState<Nivel>('carregando')
  const [session, setSession] = useState<Session | null>(null)

  const sair = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' })
    try {
      localStorage.removeItem(CHAVE_ATIVIDADE)
    } catch {
      /* ignora */
    }
    setSession(null)
    setNivel('deslogado')
  }, [])

  const atualizar = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const s = data.session
    if (!s) {
      setSession(null)
      setNivel('deslogado')
      return
    }
    if (inativoDemais()) {
      await sair()
      return
    }
    setSession(s)
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setNivel(aal?.currentLevel === 'aal2' ? 'ok' : 'precisa_2fa')
    marcarAtividade()
  }, [sair])

  useEffect(() => {
    void atualizar()
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') {
        setSession(null)
        setNivel('deslogado')
      } else if (evento === 'SIGNED_IN' || evento === 'MFA_CHALLENGE_VERIFIED' || evento === 'TOKEN_REFRESHED') {
        // adia para fora do callback (recomendação do supabase-js)
        setTimeout(() => void atualizar(), 0)
      }
    })

    const onAtividade = () => marcarAtividade()
    const checar = () => {
      if (document.visibilityState === 'visible' && inativoDemais()) void sair()
    }
    window.addEventListener('pointerdown', onAtividade, { passive: true })
    window.addEventListener('keydown', onAtividade)
    document.addEventListener('visibilitychange', checar)
    const timer = window.setInterval(checar, 60_000)
    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('pointerdown', onAtividade)
      window.removeEventListener('keydown', onAtividade)
      document.removeEventListener('visibilitychange', checar)
      window.clearInterval(timer)
    }
  }, [atualizar, sair])

  return <Ctx.Provider value={{ nivel, session, atualizar, sair }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fora do AuthProvider')
  return c
}
