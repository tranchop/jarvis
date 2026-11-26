import { SignOutIcon } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

// Trocar senha (exige sessão com 2FA). Senha nova: 12+ caracteres.
export default function Conta() {
  const { session, sair } = useAuth()
  const [nova, setNova] = useState('')
  const [repetir, setRepetir] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function trocar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    setErro(null)
    if (nova.length < 12) return setErro('Use 12 caracteres ou mais (uma frase longa é ótima).')
    if (nova !== repetir) return setErro('As duas senhas não são iguais.')
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: nova })
    setEnviando(false)
    setNova('')
    setRepetir('')
    if (error) setErro(error.message)
    else setMsg('Senha alterada. Use a nova no próximo login.')
  }

  return (
    <section>
      <header className="cabecalho">
        <div className="titulos">
          <h1>Conta</h1>
          <p className="sutil pequeno">{session?.user.email}</p>
        </div>
        <button onClick={() => void sair()}>
          <SignOutIcon size={18} /> Sair
        </button>
      </header>
      <form className="cartao formulario" onSubmit={trocar} style={{ maxWidth: 480 }}>
        <h2>Trocar senha</h2>
        <p className="sutil pequeno">Use 12 caracteres ou mais. Uma frase longa é fácil de lembrar e difícil de adivinhar.</p>
        <input type="email" autoComplete="username" value={session?.user.email ?? ''} readOnly hidden />
        <label>
          Nova senha
          <input type="password" autoComplete="new-password" minLength={12} required value={nova} onChange={(e) => setNova(e.target.value)} />
        </label>
        <label>
          Repetir nova senha
          <input type="password" autoComplete="new-password" minLength={12} required value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {msg && <p className="sucesso">{msg}</p>}
        <button className="primario" disabled={enviando}>
          {enviando ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </section>
  )
}
