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
        <div className="marca-auth">
          <img src="/jarvis/icon.svg" alt="" width={44} height={44} />
          <div>
            <h1>Jarvis</h1>
            <p className="sutil pequeno">Acesso restrito ao Pedro</p>
          </div>
        </div>
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
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="primario" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
