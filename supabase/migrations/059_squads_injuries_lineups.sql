-- ============================================================
-- Migration 059: plantillas, lesiones y alineaciones ingestables
--
-- Las tablas `players`, `injuries`, `lineups` y `lineup_players` existen
-- desde 001, pero se diseñaron para el Mundial con datos curados a mano:
-- 48 selecciones cargadas una vez, con dorsal, nacionalidad, fecha de
-- nacimiento y posición exacta de cada jugador.
--
-- API-Football no entrega ese detalle. Y ahí está la decisión de fondo de
-- esta migración: cuando el esquema exige un dato que la fuente no da, solo
-- hay dos salidas — inventarlo o relajar la columna. Se relaja.
--
-- Estado antes de esta migración: 78 jugadores, 3 lesiones, 2 alineaciones,
-- todo del Mundial. Nada de las seis ligas de clubes.
--
-- Cambios, uno por uno y con su motivo:
--
--  1. `players.api_football_id` — sin clave externa la ingesta no puede ser
--     idempotente y cada corrida duplicaría la plantilla entera.
--
--  2. NOT NULL relajados en `players`: short_name, number, position,
--     nationality, date_of_birth. `/players/squads` devuelve id, nombre,
--     edad, dorsal, posición genérica y foto. Nada más. Rellenar una fecha
--     de nacimiento inventada para satisfacer al esquema sería exactamente
--     lo que la regla Data First prohíbe.
--
--  3. `players.position_raw` — la fuente dice "Defender"; nuestro enum
--     exige CB, LB o RB. Traducir "Defender" a "CB" no es normalizar, es
--     inventar precisión que nadie nos dio. El enum se deja en NULL (salvo
--     "Goalkeeper" → 'GK', que sí es una equivalencia exacta) y el texto
--     original se guarda tal cual.
--
--  4. Se retira UNIQUE(team_id, number). Presuponía dorsales únicos y
--     siempre presentes. En una plantilla real hay jugadores sin dorsal y,
--     con altas y bajas a mitad de temporada, el mismo número aparece dos
--     veces. La restricción haría fallar la ingesta por un dato que ni
--     siquiera usamos como clave.
--
--  5. `injuries.impact_score` pasa a ser NULLABLE. Es la más importante de
--     todas. La columna alimenta al motor: `recalibrate.ts` suma el impacto
--     de las lesiones activas por equipo y `smartBetsEngine` lo usa para
--     ajustar. Con DEFAULT 5 NOT NULL, ingestar lesiones reales habría
--     inyectado miles de valores inventados directamente en las
--     predicciones. En NULL, `Number(null)` es 0 y la lesión se ve en la
--     ficha sin mover el modelo: la mostramos porque es cierta, no la
--     puntuamos porque no lo sabemos.
--
--  6. `injuries` gana clave natural (player_id, competition_id) para que la
--     ingesta sea idempotente, más `source` y `external_ref` para auditar.
--
--  7. `lineup_players`: grid_x, grid_y y position pasan a NULLABLE y se
--     amplía el CHECK de grid_x a 1..8. Los suplentes no tienen posición en
--     el campo —por eso son suplentes— y formaciones como 4-1-2-1-2 tienen
--     seis líneas, no las cinco que el CHECK original daba por máximo.
--
-- Nada de esto borra datos: las 78 filas del Mundial siguen intactas y
-- todas cumplen las restricciones nuevas, que son más laxas que las viejas.
-- ============================================================

-- ─── 1. Jugadores: clave externa e idempotencia ──────────────

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS api_football_id INTEGER;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS position_raw TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS source TEXT;

-- Un jugador pertenece a un equipo (la tabla es por equipo, no global), así
-- que la clave es el par.
--
-- El índice NO es parcial, y no por descuido: PostgREST resuelve el upsert
-- con `ON CONFLICT (team_id, api_football_id)`, y Postgres no empareja esa
-- cláusula con un índice parcial salvo que la sentencia repita su predicado
-- —cosa que PostgREST no hace—. Con un índice parcial el upsert falla con
-- "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Un índice completo funciona igual de bien aquí: Postgres
-- considera distintos dos NULL, así que las 78 filas del Mundial (sin id
-- externo) conviven sin chocar entre ellas.
CREATE UNIQUE INDEX IF NOT EXISTS players_team_api_football_id_key
  ON public.players (team_id, api_football_id);

-- ─── 2. Jugadores: relajar lo que la fuente no entrega ───────

ALTER TABLE public.players ALTER COLUMN short_name    DROP NOT NULL;
ALTER TABLE public.players ALTER COLUMN number        DROP NOT NULL;
ALTER TABLE public.players ALTER COLUMN position      DROP NOT NULL;
ALTER TABLE public.players ALTER COLUMN nationality   DROP NOT NULL;
ALTER TABLE public.players ALTER COLUMN date_of_birth DROP NOT NULL;

-- Ver punto 4 de la cabecera: el dorsal no es identificador.
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_team_id_number_key;

-- ─── 3. Lesiones: impacto honesto y upsert idempotente ───────

-- Ver punto 5: sin esto, ingestar lesiones reales inyecta impacto inventado
-- en las predicciones.
ALTER TABLE public.injuries ALTER COLUMN impact_score DROP DEFAULT;
ALTER TABLE public.injuries ALTER COLUMN impact_score DROP NOT NULL;

ALTER TABLE public.injuries ADD COLUMN IF NOT EXISTS source TEXT;
-- Fixture de API-Football en el que consta la baja: permite rastrear de
-- dónde salió cada parte sin volver a llamar a la API.
ALTER TABLE public.injuries ADD COLUMN IF NOT EXISTS api_football_fixture_id INTEGER;
-- Texto del parte tal y como lo publica la fuente ("Knee Injury"). El enum
-- injury_type se sigue rellenando, pero es una clasificación nuestra y
-- pierde matiz; el original queda aquí.
ALTER TABLE public.injuries ADD COLUMN IF NOT EXISTS reason_raw TEXT;

-- Una lesión vigente por jugador y competición. El histórico por partido no
-- es lo que esta tabla modela: se consulta con `is_active = true`.
CREATE UNIQUE INDEX IF NOT EXISTS injuries_player_competition_key
  ON public.injuries (player_id, competition_id);

CREATE INDEX IF NOT EXISTS injuries_active_team_idx
  ON public.injuries (team_id) WHERE is_active;

-- ─── 4. Alineaciones: suplentes y formaciones de seis líneas ─

ALTER TABLE public.lineup_players ALTER COLUMN position DROP NOT NULL;
ALTER TABLE public.lineup_players ALTER COLUMN grid_x   DROP NOT NULL;
ALTER TABLE public.lineup_players ALTER COLUMN grid_y   DROP NOT NULL;

ALTER TABLE public.lineup_players DROP CONSTRAINT IF EXISTS lineup_players_grid_x_check;
ALTER TABLE public.lineup_players ADD  CONSTRAINT lineup_players_grid_x_check
  CHECK (grid_x IS NULL OR (grid_x BETWEEN 1 AND 8));

ALTER TABLE public.lineup_players DROP CONSTRAINT IF EXISTS lineup_players_grid_y_check;
ALTER TABLE public.lineup_players ADD  CONSTRAINT lineup_players_grid_y_check
  CHECK (grid_y IS NULL OR (grid_y BETWEEN 1 AND 11));

-- Texto de la posición según la fuente ("G", "D", "M", "F").
ALTER TABLE public.lineup_players ADD COLUMN IF NOT EXISTS position_raw TEXT;

-- `formation` tiene DEFAULT '4-3-3'. Un valor por defecto plausible es peor
-- que un hueco: si la fuente no publica la formación, decir "4-3-3" es
-- afirmar algo que no sabemos.
ALTER TABLE public.lineups ALTER COLUMN formation DROP DEFAULT;
ALTER TABLE public.lineups ALTER COLUMN formation DROP NOT NULL;
ALTER TABLE public.lineups ADD COLUMN IF NOT EXISTS source TEXT;

-- ─── 5. RLS: las tablas ya son de lectura pública ────────────
-- players, injuries, lineups y lineup_players heredan las políticas de
-- lectura anónima creadas en 001. No se toca nada: las columnas nuevas
-- quedan cubiertas por la política existente de la tabla.
