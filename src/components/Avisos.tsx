import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface Aviso {
  id: number
  msg: string
  erro?: boolean
  desfazer?: () => void | Promise<void>
}

type Avisar = (msg: string, opcoes?: { desfazer?: Aviso['desfazer']; erro?: boolean }) => void
const Ctx = createContext<Avisar>(() => {})

// Avisos curtos no rodapé, com "Desfazer" para ações reversíveis.
export function AvisosProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([])
  const seq = useRef(0)

  const fechar = useCallback((id: number) => setLista((l) => l.filter((a) => a.id !== id)), [])

  const avisar = useCallback<Avisar>(
    (msg, opcoes) => {
      const id = ++seq.current
      setLista((l) => [...l.slice(-2), { id, msg, ...opcoes }])
      window.setTimeout(() => fechar(id), opcoes?.desfazer ? 6000 : 3500)
    },
    [fechar],
  )

  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {lista.map((a) => (
          <div key={a.id} className={`aviso ${a.erro ? 'erro-aviso' : ''}`}>
            <span className="msg">{a.msg}</span>
            {a.desfazer && (
              <button
                className="texto-btn"
                onClick={() => {
                  fechar(a.id)
                  void a.desfazer?.()
                }}
              >
                Desfazer
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAvisos = () => useContext(Ctx)
