-- ============================================================
-- Migration 030: Fix incorrect coach assignments
-- Iraq (IRQ) had Graham Arnold listed — he coaches Australia.
-- Iraq's actual coach for WC 2026 is Jesús Casas (Spain).
-- ============================================================

UPDATE teams
SET coach = 'Jesús Casas'
WHERE code = 'IRQ'
  AND competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
