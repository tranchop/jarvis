import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// Não existe tela de cadastro: a única conta é criada no painel do Supabase.
export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    setSenha('')
    // Mensagem genérica: não revela se o e-mail existe
    if (error) setErro('E-mail ou senha incorretos. Aguarde alguns segundos antes de tentar de novo.')
  }

  return (
    <main className="tela-auth">
      <form className="cartao auth" onSubmit={entrar}>
        <img src="/jarvis/icon.svg" alt="" width={56} height={56} />
        <h1>Jarvis</h1>
        <p className="sutil">Acesso restrito.</p>
        <label>
          E-mail
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={12}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button className="primario" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
