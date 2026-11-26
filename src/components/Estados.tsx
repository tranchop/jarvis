import type { ReactNode } from 'react'

export function Esqueleto({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="esqueleto" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  )
}

export function Vazio({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="vazio">
      <p>{children}</p>
      {acao}
    </div>
  )
}
