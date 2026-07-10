# SOFASCORE PLAYBOOK — Plan prioritario de producto

> Análisis de patrones de Sofascore adaptados a Veredicto · Inteligencia
> Deportiva. **Este es el plan a seguir prioritario** para la evolución de
> producto (2026-07-10). Inspiración sin copia: se extraen patrones y
> mejores prácticas, nunca diseños protegidos ni código.
>
> Regla rectora: Sofascore es dueño del *presente* del deporte; el terreno
> defendible de Veredicto es el **futuro verificable** (predicción +
> calibración pública). Se adopta todo patrón de retención compatible con
> Data First y se rechaza todo lo que exigiría fabricar datos.

---

## 1. La tesis de producto de Sofascore

1. **Live-first**: el inicio responde "¿qué pasa AHORA?" en <1 segundo.
2. **Densidad con jerarquía**: 300+ estadísticas, pero cada pantalla tiene
   UN dato protagonista; el resto es progresivamente descubrible.
3. **Identidad visual = dato**: su marca ES el número (rating en caja de
   color, gráfico de momentum). Se reconoce el producto por sus
   visualizaciones propietarias.
4. **Bucle de retención**: favoritos → notificaciones → volver.

**Equivalentes Veredicto**: (1) el inicio responde "¿qué va a pasar y con
cuánta confianza?"; (3) nuestra visualización firma es la barra 1X2 del
modelo + overlay de mercado; (4) favoritos sin auth (localStorage) hoy,
Web Push mañana. La honestidad verificable (`/inteligencia`) es el foso
que los agregadores no pueden copiar sin romper su modelo.

---

## 2. Análisis por área (resumen ejecutivo)

| Área | Patrón Sofascore | Adaptación Veredicto | Prioridad | Complejidad | Impacto |
|------|-----------------|----------------------|-----------|-------------|---------|
| Dashboard | Partidos del día, favoritos arriba, nav por fecha | Franja "Mis equipos" + chips de fecha + countdown a la final | Alta | Baja | Alto (semana de la final) |
| Partidos | Attack Momentum, H2H | H2H real (ligas 2024-25 completas); Momentum NO adaptable (sin feed por minuto — Data First) | Media | Baja-media | Medio |
| Smart Bets | Dropping odds | Movimiento del mercado: snapshots en `market_movements` + sparkline por pick | Alta | Media | Alto (re-visita diaria) |
| Predicciones | "Who will win?" (voto comunidad) | "El público vs el modelo" — voto anónimo 1X2 resuelto post-partido. ⚠️ Primera tabla con INSERT anónimo: requiere aprobación explícita | Media | Media | Alto (engagement) |
| Estadísticas | Rating propietario comprimido | Unificar presentación de probabilidad/ELO/confianza (componente único). Stats de jugadores: BLOQUEADO sin boxscores | Media | Baja | Medio directo, alto en marca |
| Rankings | Rankings navegables/compartibles | Ranking ELO Mundial (48) con contraste vs ranking FIFA + récord del torneo; espejo del patrón NBA | Alta | Baja | Alto (compartible + SEO) |
| Seguimiento | Favoritos + push | Etapa 1: localStorage + franja dashboard (sin backend). Etapa 2: Web Push (tabla de suscripciones, decisión de escritura anónima) | Alta / Media | Baja / Alta | El más alto en retención |
| Probabilidades | Win probability en vivo | Barra 1X2 unificada + overlay "modelo vs mercado" donde hay cuota real; vacío honesto donde no | Alta | Baja-media | Alto (visualización firma) |
| Móvil | Bottom tab bar, sticky, swipe | Bottom nav 5 destinos (Inicio·Partidos·Predicciones·Smart Bets·Más); sticky columns ya hecho | Alta | Media | Alto (~mayoría del tráfico) |
| Rendimiento | Caché agresivo, dato crítico primero | ISR ya desplegado (jul-2026). Siguiente: dieta bundle `players/[id]` (Recharts 108kB), prefetch tarjetas | Media | Baja-media | Medio |
| SEO | Cada partido = URL indexable con datos estructurados | sitemap dinámico + JSON-LD SportsEvent + títulos de intención ("Pronóstico X vs Y") + OG images | Alta | Baja (OG: media) | Alto y compuesto |

### Qué NO adaptar (decisión explícita, Data First)
- **Attack Momentum en vivo** — requiere feed minuto a minuto que ninguna
  fuente nuestra provee. Sustituto honesto: narrativa pre (probabilidades)
  y post (veredicto + timeline).
- **Player ratings** — sin boxscores es inventar. Sigue en backlog
  declarado.
- **Cobertura universal** — el foso de Sofascore es amplitud; el nuestro
  es profundidad verificable en pocas competiciones.

---

## 3. Roadmap

### ⚡ Quick Wins (1-3 días) — antes de la final del 19-jul
1. **SEO**: sitemap dinámico + robots + JSON-LD SportsEvent + títulos de
   intención en el detalle de partido.
2. **Ranking ELO del Mundial** (`/mundial/rankings`): 48 selecciones,
   ELO vs ranking FIFA, récord real del torneo, fase alcanzada.
3. **Favoritos localStorage** (estrella en cabecera de partido) + franja
   "Mis equipos" en el dashboard.
4. **Countdown a la final** en dashboard (mejora sola a equipos+probabilidades
   cuando exista la fila del partido) + chips de fecha → `/matches?date=`.
5. **`ProbBar1X2`**: componente unificado de barra de probabilidades —
   base de la visualización firma.

### 🔧 Mejoras importantes (1-2 semanas)
6. Bottom nav móvil (5 destinos).
7. Movimiento del mercado (snapshots `market_movements` + sparkline).
8. "El público vs el modelo" (voto anónimo — requiere aprobación del
   INSERT anónimo, migración 051 + RLS).
9. Overlay modelo vs mercado sobre ProbBar1X2.
10. H2H real en detalle (ligas con temporada completa).
11. Dieta de bundle + prefetch.
12. **Informe final del Mundial**: recap público del desempeño del modelo
    (aciertos, calibración, mejores/peores picks). Puente de retención
    julio→agosto y máximo activo de credibilidad.

### 🚀 Evolución estratégica (1-3 meses)
13. Web Push (favoritos → aviso → retorno). Requiere suscripciones.
14. PWA instalable + shell offline (manifest ya existe).
15. Perfiles de equipo de fútbol (espejo del patrón NBA) con datos
    2026-27 (requiere upgrade API-Football de agosto).
16. H2H/rachas en vivo temporada 2026-27.
17. Stats de jugadores — SOLO si se aprueba fuente con boxscores.

---

## 4. Estado de ejecución

| Quick Win | Estado |
|-----------|--------|
| 1 · SEO (sitemap/robots/JSON-LD/títulos) | ✅ 2026-07-10 |
| 2 · Ranking ELO Mundial | ✅ 2026-07-10 |
| 3 · Favoritos + Mis equipos | ✅ 2026-07-10 |
| 4 · Countdown final + chips fecha | ✅ 2026-07-10 |
| 5 · ProbBar1X2 unificada | ✅ 2026-07-10 (adopción inicial: dashboard, franja, countdown) |
| 6-17 | Pendientes — ver secciones arriba |
