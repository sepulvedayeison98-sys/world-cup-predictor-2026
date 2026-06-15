-- ============================================================
-- WORLD CUP PREDICTOR — Migration 015: resolución de predicciones
--
-- Hasta ahora `predictions.was_correct` y `actual_outcome` quedaban en NULL
-- para siempre: nada evaluaba la predicción cuando el partido terminaba. Por
-- eso las pestañas "✓ Correctas" / "✗ Incorrectas" de /predictions y la
-- Precisión del dashboard salían vacías aunque hubiera partidos finalizados.
--
-- Esta migración:
--   1. Define la función que evalúa la predicción de un partido finalizado:
--      resultado real (home/draw/away) vs. el resultado MÁS PROBABLE del modelo
--      (argmax de las prob. 1X2). was_correct = (predicho == real).
--   2. Dispara la evaluación automáticamente al pasar un partido a 'finished'.
--   3. Hace backfill de los partidos ya finalizados.
--
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- ============================================================

BEGIN;

-- Resultado más probable del modelo según las prob. 1X2 (desempate: home > away > draw)
CREATE OR REPLACE FUNCTION public.predicted_outcome_1x2(
  p_home NUMERIC, p_draw NUMERIC, p_away NUMERIC
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_home >= p_draw AND p_home >= p_away THEN 'home'
    WHEN p_away >= p_home AND p_away >= p_draw THEN 'away'
    ELSE 'draw'
  END;
$$;

-- Resultado real de un partido a partir del marcador
CREATE OR REPLACE FUNCTION public.actual_outcome_from_score(
  p_home_score INTEGER, p_away_score INTEGER
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_home_score > p_away_score THEN 'home'
    WHEN p_home_score < p_away_score THEN 'away'
    ELSE 'draw'
  END;
$$;

-- Trigger: al finalizar un partido (con marcador), evalúa su predicción
CREATE OR REPLACE FUNCTION public.resolve_prediction_on_match_finish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_actual TEXT;
BEGIN
  IF NEW.status = 'finished'
     AND NEW.home_score IS NOT NULL
     AND NEW.away_score IS NOT NULL THEN

    v_actual := public.actual_outcome_from_score(NEW.home_score, NEW.away_score);

    UPDATE public.predictions p
    SET actual_outcome = v_actual,
        was_correct = (public.predicted_outcome_1x2(
          p.home_win_probability, p.draw_probability, p.away_win_probability
        ) = v_actual),
        updated_at = NOW()
    WHERE p.match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_prediction ON public.matches;
CREATE TRIGGER trg_resolve_prediction
  AFTER UPDATE OF status, home_score, away_score ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_prediction_on_match_finish();

-- Backfill de los partidos ya finalizados
UPDATE public.predictions p
SET actual_outcome = public.actual_outcome_from_score(m.home_score, m.away_score),
    was_correct = (public.predicted_outcome_1x2(
      p.home_win_probability, p.draw_probability, p.away_win_probability
    ) = public.actual_outcome_from_score(m.home_score, m.away_score)),
    updated_at = NOW()
FROM public.matches m
WHERE p.match_id = m.id
  AND m.status = 'finished'
  AND m.home_score IS NOT NULL
  AND m.away_score IS NOT NULL;

COMMIT;

-- Verificación:
--   SELECT was_correct, COUNT(*) FROM predictions GROUP BY was_correct;
--   -- debería mostrar true/false para los finalizados y NULL para el resto.
