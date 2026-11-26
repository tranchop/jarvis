import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { mensagemErro } from '../lib/util'

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'verificar'; factorId: string }
  | { tipo: 'cadastrar'; factorId: string; qr: string; segredo: string }

// 2º fator obrigatório (app autenticador: Google Authenticator, Authy, 1Password…)
export default function DoisFatores() {
  const { atualizar, sair } = useAuth()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors()
        if (error) throw error
        const verificado = data.totp.find((f) => f.status === 'verified')
        if (verificado) {
          if (!cancelado) setEstado({ tipo: 'verificar', factorId: verificado.id })
          return
        }
        // remove cadastros incompletos antes de gerar um novo QR
        for (const f of data.all.filter((f) => f.status === 'unverified')) {
          await supabase.auth.mfa.unenroll({ factorId: f.id })
        }
        const r = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Jarvis', issuer: 'Jarvis' })
        if (r.error) throw r.error
        if (!cancelado)
          setEstado({ tipo: 'cadastrar', factorId: r.data.id, qr: r.data.totp.qr_code, segredo: r.data.totp.secret })
      } catch (e) {
        if (!cancelado) setErro(mensagemErro(e))
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    if (estado.tipo === 'carregando') return
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: estado.factorId, code: codigo.trim() })
    setEnviando(false)
    setCodigo('')
    if (error) {
      setErro('Código inválido ou expirado. Tente o código atual do app.')
      return
    }
    await atualizar()
  }

  return (
    <main className="tela-auth">
      <form className="cartao auth" onSubmit={confirmar}>
        <h1>Verificação em 2 etapas</h1>
        {estado.tipo === 'carregando' && !erro && <p className="sutil">Preparando…</p>}
        {estado.tipo === 'cadastrar' && (
          <>
            <p>
              Primeiro acesso: abra um app autenticador (Google Authenticator, Authy ou 1Password), escaneie o QR e digite o
              código de 6 dígitos.
            </p>
            <img className="qr" src={estado.qr} alt="QR code do autenticador" />
            <details>
              <summary>Não consigo escanear</summary>
              <code className="segredo">{estado.segredo}</code>
            </details>
          </>
        )}
        {estado.tipo === 'verificar' && <p>Digite o código de 6 dígitos do seu app autenticador.</p>}
        {estado.tipo !== 'carregando' && (
          <label>
            Código
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        )}
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="primario" disabled={enviando || estado.tipo === 'carregando'}>
          {enviando ? 'Verificando…' : 'Confirmar'}
        </button>
        <button type="button" className="texto-btn" onClick={() => void sair()}>
          Sair
        </button>
      </form>
    </main>
  )
}
