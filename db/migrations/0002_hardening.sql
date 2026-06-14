-- =============================================================================
-- Adaptive Learning Agent — 0002_hardening.sql
-- Production hardening: auto-updating timestamps + analytics index.
-- Run after 0001_init.sql. Idempotent where possible.
-- =============================================================================

-- Auto-bump updated_at on every UPDATE (the base schema only sets it at INSERT).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_topics_updated   ON public.topics;
DROP TRIGGER IF EXISTS trg_mastery_updated  ON public.mastery;
DROP TRIGGER IF EXISTS trg_roadmap_updated  ON public.roadmap_progress;
DROP TRIGGER IF EXISTS trg_settings_updated ON public.user_settings;
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;

CREATE TRIGGER trg_topics_updated   BEFORE UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mastery_updated  BEFORE UPDATE ON public.mastery
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_roadmap_updated  BEFORE UPDATE ON public.roadmap_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Analytics query support: recent attempts per user.
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_submitted
  ON public.quiz_attempts(user_id, submitted_at DESC);
