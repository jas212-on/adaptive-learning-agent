-- =============================================================================
-- Adaptive Learning Agent — 0003_roadmap_features.sql
-- New tables for: spaced repetition, resource voting, generated content storage,
-- collaborative features (classrooms, shared roadmaps, leaderboards),
-- learning reports, daily goals/streaks.
-- =============================================================================

-- 1. Spaced repetition review schedule
CREATE TABLE IF NOT EXISTS public.review_schedule (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  subtopic_id TEXT NOT NULL,
  next_review_at TIMESTAMPTZ NOT NULL,
  stability REAL DEFAULT 0.0,
  interval_index INT DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, topic_id, subtopic_id)
);

-- 2. Daily study goals & streaks
CREATE TABLE IF NOT EXISTS public.study_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_quiz_goal INT DEFAULT 3,
  daily_minutes_goal INT DEFAULT 30,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_study_date DATE,
  total_days_studied INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Study sessions (time tracking)
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  subtopic_id TEXT,
  activity TEXT NOT NULL DEFAULT 'quiz', -- quiz, explainer, resources, review
  duration_seconds INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- 4. Resource votes (upvote/downvote)
CREATE TABLE IF NOT EXISTS public.resource_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  subtopic_id TEXT,
  resource_url TEXT NOT NULL,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)), -- -1 = downvote, 1 = upvote
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, resource_url)
);

-- 5. Resource cache (persistent + ranking)
CREATE TABLE IF NOT EXISTS public.resource_cache (
  topic_id TEXT NOT NULL,
  subtopic_id TEXT,
  resource_url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  resource_type TEXT DEFAULT 'article',
  source_domain TEXT,
  base_score INT DEFAULT 0,
  vote_score INT DEFAULT 0,
  cached_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (topic_id, resource_url)
);

-- 6. Generated content storage (multi-device access via Supabase JSONB)
CREATE TABLE IF NOT EXISTS public.generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  subtopic_id TEXT,
  content_type TEXT NOT NULL, -- explainer, quiz, summary, graph
  content JSONB NOT NULL DEFAULT '{}',
  content_hash TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, topic_id, subtopic_id, content_type)
);

-- 7. Classrooms (instructor creates, students join)
CREATE TABLE IF NOT EXISTS public.classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  join_code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Classroom members
CREATE TABLE IF NOT EXISTS public.classroom_members (
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student', -- student, instructor
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (classroom_id, user_id)
);

-- 9. Shared roadmaps (classroom or direct share)
CREATE TABLE IF NOT EXISTS public.shared_roadmaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtopics TEXT[] DEFAULT '{}',
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Leaderboard (anonymized, aggregated weekly)
CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  quizzes_completed INT DEFAULT 0,
  avg_score REAL DEFAULT 0.0,
  topics_mastered INT DEFAULT 0,
  streak_days INT DEFAULT 0,
  total_study_minutes INT DEFAULT 0,
  rank INT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, classroom_id, week_start)
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_review_schedule_user ON public.review_schedule(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON public.study_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_votes_url ON public.resource_votes(resource_url);
CREATE INDEX IF NOT EXISTS idx_generated_content_lookup ON public.generated_content(user_id, topic_id, content_type);
CREATE INDEX IF NOT EXISTS idx_classroom_members_user ON public.classroom_members(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_roadmaps_classroom ON public.shared_roadmaps(classroom_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_week ON public.leaderboard_entries(classroom_id, week_start DESC);

-- RLS on new tables
ALTER TABLE public.review_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "own_data" ON public.review_schedule     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.study_goals         FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.study_sessions      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.resource_votes      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "public_read" ON public.resource_cache   FOR SELECT USING (true);
CREATE POLICY "own_data" ON public.generated_content   FOR ALL USING (auth.uid() = user_id);

-- Classroom policies: instructors and members can access
CREATE POLICY "instructor_all" ON public.classrooms FOR ALL
  USING (auth.uid() = instructor_id);
CREATE POLICY "member_read" ON public.classrooms FOR SELECT
  USING (id IN (SELECT classroom_id FROM public.classroom_members WHERE user_id = auth.uid()));

CREATE POLICY "own_membership" ON public.classroom_members FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY "instructor_manage" ON public.classroom_members FOR ALL
  USING (classroom_id IN (SELECT id FROM public.classrooms WHERE instructor_id = auth.uid()));

CREATE POLICY "owner_all" ON public.shared_roadmaps FOR ALL
  USING (auth.uid() = owner_id);
CREATE POLICY "classroom_read" ON public.shared_roadmaps FOR SELECT
  USING (classroom_id IN (SELECT classroom_id FROM public.classroom_members WHERE user_id = auth.uid()));
CREATE POLICY "public_read" ON public.shared_roadmaps FOR SELECT
  USING (is_public = true);

CREATE POLICY "own_data" ON public.leaderboard_entries FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY "classroom_read" ON public.leaderboard_entries FOR SELECT
  USING (classroom_id IN (SELECT classroom_id FROM public.classroom_members WHERE user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER trg_review_schedule_updated BEFORE UPDATE ON public.review_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_study_goals_updated BEFORE UPDATE ON public.study_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_classrooms_updated BEFORE UPDATE ON public.classrooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_shared_roadmaps_updated BEFORE UPDATE ON public.shared_roadmaps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_generated_content_updated BEFORE UPDATE ON public.generated_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leaderboard_updated BEFORE UPDATE ON public.leaderboard_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
