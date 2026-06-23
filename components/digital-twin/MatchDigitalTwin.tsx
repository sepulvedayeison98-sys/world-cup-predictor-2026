'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Activity, Layers, Users } from 'lucide-react'
import { PitchSVG } from './PitchSVG'
import {
  analyzeMatchTactics,
  parseFormation,
  type MatchTacticalAnalysis,
  type TacticalProfile,
} from '@/lib/intelligence/tacticalAnalysis'

// ─── Utilidades ────────────────────────────────────────────────────────────────

/** Posiciones X en el campo (0–100) por línea de formación (home → derecha) */
function formationXPositions(lines: number[]): number[] {
  // GK en x=5, luego 4 líneas equidistantes hasta x=82
  const totalLines = lines.length + 1  // +1 por portero
  const positions: number[] = [5]
  for (let i = 0; i < lines.length; i++) {
    positions.push(5 + ((i + 1) / totalLines) * 77)
  }
  return positions
}

/** Posiciones Y equidistantes para N jugadores en una línea (0–65) */
function lineYPositions(count: number): number[] {
  if (count === 1) return [32.5]
  const margin = 8
  const step = (65 - margin * 2) / (count - 1)
  return Array.from({ length: count }, (_, i) => margin + i * step)
}

// ─── Mapa de calor de zonas ────────────────────────────────────────────────────

function ZoneHeatMap({
  analysis,
  showHome,
  showAway,
}: {
  analysis: MatchTacticalAnalysis
  showHome: boolean
  showAway: boolean
}) {
  const COLS = 6
  const ROWS = 3
  const colW = 96 / COLS   // ancho de cada columna en SVG units
  const rowH = 61 / ROWS

  return (
    <>
      {Array.from({ length: COLS }).map((_, col) =>
        Array.from({ length: ROWS }).map((_, row) => {
          const homeIntensity = showHome ? analysis.home.zoneMap.zones[col]?.[row] ?? 0 : 0
          const awayIntensity = showAway ? analysis.away.zoneMap.zones[col]?.[row] ?? 0 : 0

          // Blend: si ambos tienen presión alta la zona se vuelve amarilla (disputa)
          const both = homeIntensity > 0.4 && awayIntensity > 0.4
          const r = both ? 250 : showHome ? 16  : 239
          const g = both ? 200 : showHome ? 185 : 68
          const b = both ? 10  : showHome ? 129 : 68
          const alpha = Math.max(homeIntensity, awayIntensity) * 0.55

          if (alpha < 0.05) return null

          return (
            <rect
              key={`${col}-${row}`}
              x={2 + col * colW}
              y={2 + row * rowH}
              width={colW}
              height={rowH}
              fill={`rgba(${r},${g},${b},${alpha})`}
              rx="1"
            />
          )
        })
      )}
    </>
  )
}

// ─── Puntos de jugadores ───────────────────────────────────────────────────────

function PlayerDots({
  formation,
  isHome,
  teamColor,
  teamCode,
}: {
  formation: number[]
  isHome: boolean
  teamColor: string
  teamCode: string
}) {
  const xPositions = formationXPositions(formation)

  // Para visitante, invertimos el campo (x → 100 - x)
  const xOf = (x: number) => isHome ? x : 100 - x

  const dots: { x: number; y: number; label: string }[] = []

  // Portero
  dots.push({ x: xOf(xPositions[0]), y: 32.5, label: 'PO' })

  // Líneas de jugadores
  formation.forEach((count, lineIdx) => {
    const lineX = xPositions[lineIdx + 1]
    const ys = lineYPositions(count)
    ys.forEach(y => {
      dots.push({ x: xOf(lineX), y, label: '' })
    })
  })

  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <>
      {dots.map((dot, i) => (
        <g key={i}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{ cursor: 'default' }}
        >
          {/* Sombra */}
          <circle cx={dot.x} cy={dot.y + 0.5} r={2.8} fill="rgba(0,0,0,0.4)" />
          {/* Camiseta */}
          <circle cx={dot.x} cy={dot.y} r={2.6}
            fill={teamColor}
            stroke="white"
            strokeWidth={hovered === i ? 0.8 : 0.4}
            opacity={hovered === i ? 1 : 0.92}
          />
          {/* Número/iniciales */}
          {dot.label && (
            <text x={dot.x} y={dot.y + 0.7}
              textAnchor="middle"
              fill="white"
              fontSize="2"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {dot.label}
            </text>
          )}
        </g>
      ))}
    </>
  )
}

// ─── Métricas laterales ────────────────────────────────────────────────────────

const STYLE_LABEL: Record<string, string> = {
  'posesión':    'Posesión',
  'contragolpe': 'Contragolpe',
  'directo':     'Directo',
  'equilibrado': 'Equilibrado',
}

function TacticalMetric({ label, home, away, homeColor, awayColor }: {
  label: string
  home: number
  away: number
  homeColor: string
  awayColor: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span className={cn('font-bold', homeColor)}>{(home * 100).toFixed(0)}%</span>
        <span className="text-zinc-600">{label}</span>
        <span className={cn('font-bold', awayColor)}>{(away * 100).toFixed(0)}%</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-800">
        {/* Home side (left, home color) */}
        <div className="h-full" style={{ width: `${home * 50}%`, background: homeColor === 'text-emerald-400' ? '#10b981' : '#3b82f6', marginLeft: `${50 - home * 50}%` }} />
        {/* Away side (right, away color) */}
        <div className="h-full" style={{ width: `${away * 50}%`, background: awayColor === 'text-red-400' ? '#ef4444' : '#f59e0b' }} />
      </div>
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────────

interface Props {
  homeStats: any | null
  awayStats: any | null
  match: any
  homeLineup?: any | null   // { formation, lineup_players: [...] }
  awayLineup?: any | null
}

type ViewMode = 'zonas' | 'formaciones' | 'ambos'

export function MatchDigitalTwin({ homeStats, awayStats, match, homeLineup, awayLineup }: Props) {
  const [view, setView] = useState<ViewMode>('ambos')

  const homeTeam = match?.home_team
  const awayTeam = match?.away_team
  const homeCode = homeTeam?.code ?? 'LOC'
  const awayCode = awayTeam?.code ?? 'VIS'

  const homeFormation = parseFormation(homeLineup?.formation ?? homeTeam?.preferred_formation)
  const awayFormation = parseFormation(awayLineup?.formation ?? awayTeam?.preferred_formation)

  const analysis = useMemo<MatchTacticalAnalysis>(() => {
    return analyzeMatchTactics(
      homeStats ? {
        avgXg:            homeStats.avg_xg            ?? 1.2,
        avgXga:           homeStats.avg_xga           ?? 1.1,
        avgPossession:    homeStats.avg_possession     ?? 50,
        avgShots:         homeStats.avg_shots          ?? 12,
        avgShotsOnTarget: homeStats.avg_shots_on_target ?? 4,
        avgCorners:       homeStats.avg_corners        ?? 5,
        avgYellowCards:   homeStats.avg_yellow_cards   ?? 2,
        form:             homeStats.form               ?? [],
      } : null,
      awayStats ? {
        avgXg:            awayStats.avg_xg            ?? 1.2,
        avgXga:           awayStats.avg_xga           ?? 1.1,
        avgPossession:    awayStats.avg_possession     ?? 50,
        avgShots:         awayStats.avg_shots          ?? 12,
        avgShotsOnTarget: awayStats.avg_shots_on_target ?? 4,
        avgCorners:       awayStats.avg_corners        ?? 5,
        avgYellowCards:   awayStats.avg_yellow_cards   ?? 2,
        form:             awayStats.form               ?? [],
      } : null,
      homeLineup?.formation,
      awayLineup?.formation,
    )
  }, [homeStats, awayStats, homeLineup, awayLineup])

  const showZones = view === 'zonas' || view === 'ambos'
  const showPlayers = view === 'formaciones' || view === 'ambos'

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">Match Digital Twin</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Proyección táctica basada en estadísticas históricas del torneo
            </p>
          </div>
        </div>

        {/* Selector de vista */}
        <div className="flex gap-1">
          {([
            { id: 'zonas',       icon: Layers, label: 'Zonas' },
            { id: 'formaciones', icon: Users,  label: 'Formaciones' },
            { id: 'ambos',       icon: Activity, label: 'Ambos' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setView(id)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border transition-colors',
                view === id
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Campo de juego */}
      <div className="card overflow-hidden">
        {/* Team codes */}
        <div className="flex justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-emerald-400">{homeCode}</span>
            <span className="text-[10px] text-zinc-600">{homeLineup?.formation ?? '4-3-3'}</span>
          </div>
          <span className="text-[10px] text-zinc-600 self-center">→ ataque →</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-600">{awayLineup?.formation ?? '4-3-3'}</span>
            <span className="text-xs font-bold text-red-400">{awayCode}</span>
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          </div>
        </div>

        <div className="px-3 pb-3">
          <PitchSVG width="100%" height="auto">
            {/* Mapa de calor */}
            {showZones && (
              <ZoneHeatMap analysis={analysis} showHome showAway />
            )}

            {/* Jugadores home */}
            {showPlayers && (
              <PlayerDots
                formation={homeFormation}
                isHome={true}
                teamColor="#10b981"
                teamCode={homeCode}
              />
            )}

            {/* Jugadores away */}
            {showPlayers && (
              <PlayerDots
                formation={awayFormation}
                isHome={false}
                teamColor="#ef4444"
                teamCode={awayCode}
              />
            )}

            {/* Zona clave — línea vertical de disputa */}
            {showZones && analysis.contestedZones.length > 0 && (
              <line
                x1="50" y1="4" x2="50" y2="61"
                stroke="rgba(250,200,10,0.4)"
                strokeWidth="0.8"
                strokeDasharray="2 1"
              />
            )}
          </PitchSVG>
        </div>

        {/* Leyenda zona calor */}
        {showZones && (
          <div className="flex items-center justify-center gap-4 pb-3 text-[9px] text-zinc-600">
            <div className="flex items-center gap-1">
              <div className="h-2 w-4 rounded-sm bg-emerald-500/50" />
              <span>Presión {homeCode}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-4 rounded-sm bg-yellow-500/50" />
              <span>Zona disputada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-4 rounded-sm bg-red-500/50" />
              <span>Presión {awayCode}</span>
            </div>
          </div>
        )}
      </div>

      {/* Zona clave del partido */}
      <div className="card px-4 py-3 border-l-2 border-l-amber-500/40">
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          <span className="text-amber-400 font-semibold">Zona clave: </span>
          {analysis.keyBattleZone}
        </p>
      </div>

      {/* Métricas tácticas comparadas */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Métricas tácticas
          </h4>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-emerald-400 font-bold">{homeCode} · {STYLE_LABEL[analysis.home.style]}</span>
            <span className="text-[10px] text-red-400 font-bold">{awayCode} · {STYLE_LABEL[analysis.away.style]}</span>
          </div>
        </div>

        <TacticalMetric label="Intensidad de ataque"
          home={analysis.home.attackIntensity} away={analysis.away.attackIntensity}
          homeColor="text-emerald-400" awayColor="text-red-400" />
        <TacticalMetric label="Bloque defensivo"
          home={analysis.home.defensiveBlock} away={analysis.away.defensiveBlock}
          homeColor="text-emerald-400" awayColor="text-red-400" />
        <TacticalMetric label="Presión alta"
          home={analysis.home.pressureHigh} away={analysis.away.pressureHigh}
          homeColor="text-emerald-400" awayColor="text-red-400" />
        <TacticalMetric label="Amenaza balón parado"
          home={analysis.home.setpieceThreat} away={analysis.away.setpieceThreat}
          homeColor="text-emerald-400" awayColor="text-red-400" />
        <TacticalMetric label="Forma reciente"
          home={analysis.home.formScore} away={analysis.away.formScore}
          homeColor="text-emerald-400" awayColor="text-red-400" />
      </div>

      {/* Dominio de campo */}
      <div className="card p-4">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Dominio proyectado del campo
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400 font-bold w-8 text-right">{homeCode}</span>
          <div className="flex-1 flex h-4 rounded-full overflow-hidden bg-zinc-800">
            {(() => {
              const total = analysis.home.attackIntensity + analysis.away.attackIntensity || 1
              const homePct = Math.round((analysis.home.attackIntensity / total) * 100)
              const awayPct = 100 - homePct
              return (
                <>
                  <div className="h-full bg-emerald-500 flex items-center justify-center"
                    style={{ width: `${homePct}%` }}>
                    <span className="text-[9px] text-white font-bold">{homePct}%</span>
                  </div>
                  <div className="h-full bg-red-500 flex items-center justify-center"
                    style={{ width: `${awayPct}%` }}>
                    <span className="text-[9px] text-white font-bold">{awayPct}%</span>
                  </div>
                </>
              )
            })()}
          </div>
          <span className="text-xs text-red-400 font-bold w-8">{awayCode}</span>
        </div>
        <p className="text-[9px] text-zinc-700 mt-2">
          Estimado a partir de xG, posesión media y forma reciente. No refleja alineaciones confirmadas.
        </p>
      </div>
    </div>
  )
}
