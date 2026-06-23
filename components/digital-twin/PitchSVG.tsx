'use client'

/**
 * Campo de fútbol SVG.
 * ViewBox: 0 0 100 65
 * El equipo local ataca de izquierda a derecha (→).
 * El equipo visitante ataca de derecha a izquierda (←).
 */

// ─── Líneas del campo ──────────────────────────────────────────────────────────

export function PitchSVG({
  width = '100%',
  height = '100%',
  children,
}: {
  width?: string | number
  height?: string | number
  children?: React.ReactNode
}) {
  return (
    <svg
      viewBox="0 0 100 65"
      width={width}
      height={height}
      className="overflow-visible"
      style={{ background: 'transparent' }}
    >
      {/* Fondo césped */}
      <rect x="0" y="0" width="100" height="65" rx="2" fill="#14532d" />

      {/* Franjas de hierba alternadas */}
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x={i * 10} y="0" width="10" height="65"
          fill={i % 2 === 0 ? '#15803d' : '#166534'} />
      ))}

      {/* Líneas exteriores */}
      <rect x="2" y="2" width="96" height="61" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />

      {/* Línea central */}
      <line x1="50" y1="2" x2="50" y2="63" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />

      {/* Círculo central */}
      <circle cx="50" cy="32.5" r="8" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <circle cx="50" cy="32.5" r="0.7" fill="rgba(255,255,255,0.5)" />

      {/* Área grande local (izquierda) */}
      <rect x="2" y="14" width="16" height="37" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      {/* Área pequeña local */}
      <rect x="2" y="24.5" width="6" height="16" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      {/* Arco local */}
      <path d="M 18 22 A 10 10 0 0 1 18 43" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      {/* Portería local */}
      <rect x="0" y="29" width="2" height="7" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
      {/* Punto penalti local */}
      <circle cx="12" cy="32.5" r="0.5" fill="rgba(255,255,255,0.5)" />

      {/* Área grande visitante (derecha) */}
      <rect x="82" y="14" width="16" height="37" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      {/* Área pequeña visitante */}
      <rect x="92" y="24.5" width="6" height="16" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      {/* Arco visitante */}
      <path d="M 82 22 A 10 10 0 0 0 82 43" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      {/* Portería visitante */}
      <rect x="98" y="29" width="2" height="7" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
      {/* Punto penalti visitante */}
      <circle cx="88" cy="32.5" r="0.5" fill="rgba(255,255,255,0.5)" />

      {/* Corners */}
      {[
        { x: 2, y: 2,  d: 'M 2 5 A 3 3 0 0 0 5 2' },
        { x: 98, y: 2, d: 'M 98 5 A 3 3 0 0 1 95 2' },
        { x: 2, y: 63, d: 'M 2 60 A 3 3 0 0 1 5 63' },
        { x: 98, y: 63,d: 'M 98 60 A 3 3 0 0 0 95 63' },
      ].map((c, i) => (
        <path key={i} d={c.d} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      ))}

      {children}
    </svg>
  )
}
