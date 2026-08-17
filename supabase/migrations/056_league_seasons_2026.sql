-- ============================================================
-- Migration 056: una competición POR TEMPORADA para las ligas
--
-- Hasta ahora cada liga tenía UNA fila en `competitions` y la temporada era
-- solo una etiqueta. Al llegar la campaña 2026 eso habría metido dos
-- temporadas en la misma tabla de posiciones (equipos con 76 partidos): el
-- constraint (competition_id, match_number) lo impidió — hizo su trabajo.
--
-- Decisión (opción B, aprobada): crear filas nuevas para 2026 y CONSERVAR
-- las de 2024-25 como histórico. Así el backtest medido (~1.890 predicciones)
-- sobrevive y se puede comparar temporada contra temporada.
--
-- UUID determinista: {apiFootballId}{año}-0000-4000-8000-{apiFootballId}.
-- Nada se borra ni se reescribe: esta migración solo INSERTA.
-- ============================================================

INSERT INTO public.competitions (id, name, short_name, type, season, country, sport_id, is_active, start_date, end_date)
VALUES
  -- Europeas: campaña ago-may, etiqueta "2026-27"
  ('39002026-0000-4000-8000-000000000039', 'Premier League', 'PL',     'league', '2026-27', 'Inglaterra', 1, true,  '2026-08-15', '2027-05-23'),
  ('14002026-0000-4000-8000-000000000140', 'La Liga',        'LaLiga', 'league', '2026-27', 'España',     1, true,  '2026-08-15', '2027-05-23'),
  ('13502026-0000-4000-8000-000000000135', 'Serie A',        'SerieA', 'league', '2026-27', 'Italia',     1, true,  '2026-08-22', '2027-05-23'),
  ('78002026-0000-4000-8000-000000000078', 'Bundesliga',     'BL',     'league', '2026-27', 'Alemania',   1, true,  '2026-08-21', '2027-05-15'),
  ('61002026-0000-4000-8000-000000000061', 'Ligue 1',        'L1',     'league', '2026-27', 'Francia',    1, true,  '2026-08-15', '2027-05-22'),
  -- Colombia: año calendario (Apertura + Clausura), etiqueta "2026"
  ('23902026-0000-4000-8000-000000000239', 'Liga BetPlay',   'BetPlay','league', '2026',    'Colombia',   1, true,  '2026-01-17', '2026-12-20')
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      short_name = EXCLUDED.short_name,
      season = EXCLUDED.season,
      country = EXCLUDED.country,
      is_active = EXCLUDED.is_active,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date;

-- Las temporadas anteriores dejan de ser "activas": son histórico consultable.
UPDATE public.competitions
   SET is_active = false
 WHERE type = 'league' AND sport_id = 1
   AND season IN ('2024-25', '2024');
