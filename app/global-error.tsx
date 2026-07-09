'use client'

/**
 * Último recurso: error en el layout raíz. Debe renderizar su propio
 * <html>/<body> porque sustituye al layout completo.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body style={{ background: '#09090b', color: '#e4e4e7', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>La aplicación no pudo iniciar</h1>
          <p style={{ maxWidth: 420, fontSize: 14, color: '#a1a1aa' }}>
            Error inesperado en el arranque. Reintenta; si persiste, vuelve en unos minutos.
          </p>
          <button
            onClick={reset}
            style={{ border: '1px solid rgba(16,185,129,.4)', background: 'rgba(16,185,129,.1)', color: '#34d399', borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
