-- ============================================================
-- WORLD CUP PREDICTOR — Migration 016: Resultados Jornada 1
--
-- Actualiza los partidos ya jugados (11-15 jun 2026) con sus
-- marcadores finales y cambia el estado a 'finished'.
--
-- El trigger match_standings_update recalcula automáticamente
-- las tablas de grupo cuando el status cambia a 'finished'.
--
-- Grupos actualizados: A, B, C, D, E, F, G, H
-- Partidos jugados: 14 del calendario 005 + 2 del seed 002
-- ============================================================

BEGIN;

-- ─── Grupo A ─────────────────────────────────────────────────
-- Mexico 2-0 Sudafrica  (11 jun · Estadio Azteca)
UPDATE matches SET status = 'finished', home_score = 2, away_score = 0
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 101;

-- Corea del Sur 1-1 Chequia  (11 jun · Guadalajara)
UPDATE matches SET status = 'finished', home_score = 1, away_score = 1
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 102;

-- ─── Grupo B ─────────────────────────────────────────────────
-- Canada 2-1 Bosnia  (12 jun · Toronto)
UPDATE matches SET status = 'finished', home_score = 2, away_score = 1
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 103;

-- Suiza 3-0 Qatar  (13 jun · San Francisco)
UPDATE matches SET status = 'finished', home_score = 3, away_score = 0
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 105;

-- ─── Grupo C (matches de seed 002 con id explícito) ──────────
-- Brasil 2-0 Marruecos  (13 jun · MetLife Stadium)
UPDATE matches SET status = 'finished', home_score = 2, away_score = 0
  WHERE id = '30000000-0000-4000-a000-000000000001';

-- Haiti 0-3 Escocia  (14 jun · Gillette Stadium)
UPDATE matches SET status = 'finished', home_score = 0, away_score = 3
  WHERE id = '30000000-0000-4000-a000-000000000002';

-- ─── Grupo D ─────────────────────────────────────────────────
-- USA 3-1 Paraguay  (12 jun · Los Angeles)
UPDATE matches SET status = 'finished', home_score = 3, away_score = 1
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 104;

-- Australia 1-1 Turquia  (13 jun · Vancouver)
UPDATE matches SET status = 'finished', home_score = 1, away_score = 1
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 106;

-- ─── Grupo E ─────────────────────────────────────────────────
-- Alemania 4-0 Curazao  (14 jun · Houston)
UPDATE matches SET status = 'finished', home_score = 4, away_score = 0
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 107;

-- Costa de Marfil 1-2 Ecuador  (14 jun · Philadelphia)
UPDATE matches SET status = 'finished', home_score = 1, away_score = 2
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 109;

-- ─── Grupo F ─────────────────────────────────────────────────
-- Paises Bajos 2-1 Japon  (14 jun · Dallas)
UPDATE matches SET status = 'finished', home_score = 2, away_score = 1
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 108;

-- Suecia 2-0 Tunez  (14 jun · Monterrey)
UPDATE matches SET status = 'finished', home_score = 2, away_score = 0
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 110;

-- ─── Grupo G ─────────────────────────────────────────────────
-- Belgica 2-0 Egipto  (15 jun · Vancouver)
UPDATE matches SET status = 'finished', home_score = 2, away_score = 0
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 112;

-- Iran 2-0 Nueva Zelanda  (15 jun · Los Angeles)
UPDATE matches SET status = 'finished', home_score = 2, away_score = 0
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 114;

-- ─── Grupo H ─────────────────────────────────────────────────
-- Espana 3-0 Cabo Verde  (15 jun · Atlanta)
UPDATE matches SET status = 'finished', home_score = 3, away_score = 0
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 111;

-- Uruguay 2-1 Arabia Saudita  (15 jun · Miami)
UPDATE matches SET status = 'finished', home_score = 2, away_score = 1
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 113;

-- ─── Recalcular tablas de todos los grupos actualizados ───────
-- El trigger recalcula por grupo al actualizar status,
-- pero lo llamamos explícitamente para garantizar consistencia.
DO $$
DECLARE g RECORD;
BEGIN
  FOR g IN
    SELECT id FROM groups
    WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      AND letter IN ('A','B','C','D','E','F','G','H')
  LOOP
    PERFORM recalculate_group_standings(g.id);
  END LOOP;
END $$;

COMMIT;

-- ─── Verificación rápida ──────────────────────────────────────
-- SELECT t.code, gs.played, gs.won, gs.drawn, gs.lost,
--        gs.goals_for, gs.goals_against, gs.points
-- FROM group_standings gs
-- JOIN groups g ON g.id = gs.group_id
-- JOIN teams t ON t.id = gs.team_id
-- WHERE g.letter = 'A'
-- ORDER BY gs.points DESC, gs.goal_difference DESC;
