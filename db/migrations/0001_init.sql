-- =============================================================================
-- Adaptive Learning Agent — 0001_init.sql
-- Base schema: tables, indexes, RLS policies, and signup trigger.
-- Run this first in a fresh Supabase project (SQL Editor).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Topics metadata (NO raw OCR text — just processed topic info).
--    Raw OCR text is kept local (backend/output.json), never uploaded.
CREATE TABLE public.topics (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  level TEXT DEFAULT 'intermediate',
  confidence REAL DEFAULT 0.0,
  tags TEXT[] DEFAULT '{}',
  subtopics TEXT[] DEFAULT '{}',
  summary TEXT,
  detected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

-- 3. Mastery state (Bayesian Knowledge Tracing — replaces local bkt_state.json)
CREATE TABLE public.mastery (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  subtopic_id TEXT NOT NULL,
  mastery REAL DEFAULT 0.0,
  attempts INT DEFAULT 0,
  last_score_pct INT,
  last_correct_count INT,
  last_total INT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, topic_id, subtopic_id)
);

-- 4. Quiz attempt history (analytics; the quiz content itself stays local)
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  subtopic_id TEXT NOT NULL,
  score_pct INT NOT NULL,
  correct_count INT NOT NULL,
  total INT NOT NULL,
  mastery_after REAL,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Roadmap progress (replaces localStorage ala.roadmapProgress.*)
CREATE TABLE public.roadmap_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  subtopic_id TEXT NOT NULL,
  explainer_done BOOLEAN DEFAULT false,
  resources_done BOOLEAN DEFAULT false,
  quiz_done BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, topic_id, subtopic_id)
);

-- 6. User settings (replaces localStorage)
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  last_viewed JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_topics_user ON public.topics(user_id);
CREATE INDEX idx_mastery_user_topic ON public.mastery(user_id, topic_id);
CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts(user_id, topic_id);
CREATE INDEX idx_roadmap_user ON public.roadmap_progress(user_id, topic_id);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies: each user can only access their own rows.
-- The server uses the service-role key, which bypasses RLS for trusted writes.
CREATE POLICY "own_data" ON public.profiles         FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_data" ON public.topics           FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.mastery          FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.quiz_attempts    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.roadmap_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.user_settings    FOR ALL USING (auth.uid() = user_id);

-- Auto-create profile + settings rows on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
