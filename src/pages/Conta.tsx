import { CalendarBlankIcon, SignOutIcon } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAvisos } from '../components/Avisos'
import { Esqueleto } from '../components/Estados'
import { useAuth } from '../lib/auth'
import { conectarGoogle, desconectarGoogle, statusGoogle } from '../lib/google'
import { supabase } from '../lib/supabase'
import { mensagemErro, useCarregar } from '../lib/util'

const RETORNO_GOOGLE: Record<string, string> = {
  ok: 'Google Agenda conectada. Seus eventos já aparecem na tela inicial.',
  cancelado: 'Conexão cancelada. Nada foi alterado.',
  expirado: 'O pedido de conexão expirou. Tente de novo.',
  sem_permissao: 'O Google não liberou a leitura da agenda. Tente de novo e marque a permissão de ver a agenda.',
  erro: 'Não foi possível concluir a conexão com o Google. Tente de novo.',
}

export default function Conta() {
  const { session, sair } = useAuth()
  const avisar = useAvisos()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [nova, setNova] = useState('')
  const [repetir, setRepetir] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const google = useCarregar(statusGoogle, [])

  // aviso ao voltar do Google
  useEffect(() => {
    const r = params.get('google')
    if (!r) return
    avisar(RETORNO_GOOGLE[r] ?? RETORNO_GOOGLE.erro, { erro: r !== 'ok' })
    navigate('/conta', { replace: true })
    void google.recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

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

  async function conectar() {
    setOcupado(true)
    try {
      await conectarGoogle()
    } catch (e) {
      avisar(mensagemErro(e), { erro: true })
      setOcupado(false)
    }
  }

  async function desconectar() {
    setOcupado(true)
    try {
      await desconectarGoogle()
      avisar('Google Agenda desconectada. O acesso foi revogado no Google.')
      await google.recarregar()
    } catch (e) {
      avisar(mensagemErro(e), { erro: true })
    } finally {
      setOcupado(false)
    }
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

      <div className="pilha" style={{ maxWidth: 560 }}>
        <div className="cartao formulario">
          <div className="cab-mini" style={{ fontSize: '1rem', color: 'var(--texto)', fontWeight: 600 }}>
            <CalendarBlankIcon size={20} /> Google Agenda
          </div>
          {google.erro && <p className="erro">{google.erro}</p>}
          {!google.dados && !google.erro && <Esqueleto linhas={1} />}
          {google.dados &&
            (google.dados.conectado ? (
              <>
                <p className="sutil">
                  Conectada{google.dados.email ? ` a ${google.dados.email}` : ''}. O Jarvis só lê seus eventos; não cria nem altera nada.
                </p>
                <div>
                  <button disabled={ocupado} onClick={() => void desconectar()}>
                    {ocupado ? 'Desconectando...' : 'Desconectar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="sutil">
                  Mostre seus eventos na tela inicial. O acesso é só de leitura e a chave fica guardada criptografada no servidor, nunca no aparelho.
                </p>
                <div>
                  <button className="primario" disabled={ocupado} onClick={() => void conectar()}>
                    {ocupado ? 'Abrindo o Google...' : 'Conectar Google Agenda'}
                  </button>
                </div>
              </>
            ))}
        </div>

        <form className="cartao formulario" onSubmit={trocar}>
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
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
          {msg && <p className="sucesso">{msg}</p>}
          <div>
            <button className="primario" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
