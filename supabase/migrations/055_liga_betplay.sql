-- ============================================================
-- Migration 055: Liga BetPlay (Categoría Primera A, Colombia)
--
-- Sexta liga de fútbol de la plataforma. Reutiliza ÍNTEGRAMENTE la
-- tubería existente de ligas (ingesta, motor, standings, vistas): lo
-- único que hace falta es la fila de competición con su id determinista.
--
-- Id derivado del id de API-Football (239), mismo patrón que las otras
-- ligas (Premier 39 → 39000000-…-039).
--
-- OJO — diferencia estructural declarada: el fútbol colombiano NO sigue el
-- calendario europeo agosto-mayo. Su temporada es el AÑO CALENDARIO y se
-- juega en dos torneos (Apertura y Clausura) más cuadrangulares y finales.
-- Por eso `season` es '2024' y no '2024-25'. La distinción entre torneos
-- viene en la columna `round` de cada partido (la ingesta ya la guarda).
-- ============================================================

INSERT INTO public.competitions (id, name, short_name, type, season, country, sport_id, is_active, start_date, end_date)
VALUES (
  '23900000-0000-4000-8000-000000000239',
  'Liga BetPlay',
  'BetPlay',
  'league',
  '2024',
  'Colombia',
  1,
  false,              -- histórico ingestado; se activa cuando haya temporada en vivo
  '2024-01-19',       -- primer partido real de la temporada 2024 (verificado en la fuente)
  '2024-12-22'        -- último partido real (final del Clausura)
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      short_name = EXCLUDED.short_name,
      type = EXCLUDED.type,
      season = EXCLUDED.season,
      country = EXCLUDED.country,
      sport_id = EXCLUDED.sport_id,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date;
