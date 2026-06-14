# 🏆 World Cup Predictor 2026

Plataforma profesional de análisis y predicción para el Mundial FIFA 2026.  
Inspirada en TradingView · Sofascore · Bloomberg Terminal.

**🌐 En vivo:** https://world-cup-predictor-2026-flax.vercel.app

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15 + TypeScript |
| Estilos | Tailwind CSS + shadcn/ui |
| Gráficos | Recharts |
| Tablas | TanStack Table |
| Estado servidor | React Query |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Deploy | Vercel |

---

## Fases del proyecto

| Fase | Contenido | Estado |
|------|-----------|--------|
| **1** | Fundamentos: tipos, schema SQL, servicios, layout, dashboard | ✅ Completa |
| 2 | Módulo de Partidos: tabla avanzada + filtros + detalle | 🔜 |
| 3 | Módulo de Predicción + motor de cálculo | 🔜 |
| 4 | Jugadores, Alineaciones, Lesiones | 🔜 |
| 5 | Apuestas de valor + Simulación + Grupos completos | 🔜 |

---

## Instalación local

### 1. Clonar y preparar

```bash
git clone https://github.com/tu-user/world-cup-predictor.git
cd world-cup-predictor
npm install
cp .env.example .env.local
# Rellena las variables en .env.local
```

### 2. Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar en orden:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_data.sql`
3. Copiar las claves en `.env.local`

### 3. Ejecutar en desarrollo

```bash
npm run dev
# → http://localhost:3000
```

---

## Estructura de archivos (Fase 1)

```
world-cup-predictor/
├── app/
│   ├── layout.tsx              # Root layout con sidebar + topbar
│   ├── globals.css             # Design tokens + componentes base
│   └── dashboard/
│       └── page.tsx            # Dashboard principal (Server Component)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # Sidebar colapsable
│   │   ├── Topbar.tsx          # Barra superior
│   │   ├── ThemeProvider.tsx
│   │   └── QueryProvider.tsx
│   ├── dashboard/
│   │   ├── KPICards.tsx        # 7 KPIs principales
│   │   ├── UpcomingMatchesWidget.tsx
│   │   ├── ValueBetsWidget.tsx
│   │   └── GroupStandingsWidget.tsx
│   └── charts/
│       └── ROIChart.tsx        # ROI + Accuracy charts
├── services/
│   ├── matches.service.ts
│   ├── predictions.service.ts  # Incluye motor de cálculo
│   └── teams.service.ts
├── types/
│   └── index.ts                # Todos los tipos del dominio
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── utils.ts
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql  # Schema + RLS + triggers
        └── 002_seed_data.sql       # WC 2026 data real
```

---

## Motor de predicción

El modelo usa 10 variables con los siguientes pesos:

| Variable | Peso |
|----------|------|
| Forma reciente | 20% |
| Calidad de plantilla | 15% |
| Estado de jugadores | 15% |
| Estadísticas avanzadas (xG/xGA) | 15% |
| Análisis táctico | 10% |
| ELO Rating | 10% |
| Mercado de apuestas | 5% |
| Motivación / contexto | 5% |
| Factores externos | 3% |
| Historial H2H | 2% |

Las probabilidades se normalizan para sumar exactamente 100%.  
Ver: `services/predictions.service.ts → computePrediction()`

---

## Base de datos

- **15 tablas** con relaciones completas
- **Índices** sobre todos los campos de filtrado frecuente
- **RLS** activado en todas las tablas
- **Triggers** automáticos para standings y snapshot de predicciones
- **Función SQL** `recalculate_group_standings()` que recalcula al finalizar cada partido

---

## Deploy en Vercel

```bash
# Instalar CLI de Vercel
npm i -g vercel

# Deploy
vercel --prod

# Agregar variables de entorno en Vercel Dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
```

---

## Fase 2 — próximos pasos

- Tabla avanzada de partidos con TanStack Table
- Filtros: fecha, grupo, equipo, confianza, estado
- Vista detallada de partido con comparación visual de equipos
- Radar chart de estadísticas avanzadas
- Historial de probabilidades (línea temporal)
