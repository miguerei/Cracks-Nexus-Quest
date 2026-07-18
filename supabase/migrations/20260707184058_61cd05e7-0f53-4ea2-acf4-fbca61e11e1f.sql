
-- ========== profiles ==========
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ========== player_state ==========
CREATE TABLE public.player_state (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  has_profile BOOLEAN NOT NULL DEFAULT false,
  avatar JSONB NOT NULL DEFAULT '{}'::jsonb,
  xp INT NOT NULL DEFAULT 0,
  crystals INT NOT NULL DEFAULT 0,
  coins INT NOT NULL DEFAULT 0,
  nexos INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  streak INT NOT NULL DEFAULT 0,
  document_name TEXT,
  worlds_cleared TEXT[] NOT NULL DEFAULT '{}',
  missions_cleared TEXT[] NOT NULL DEFAULT '{}',
  achievements TEXT[] NOT NULL DEFAULT '{}',
  weak_concepts TEXT[] NOT NULL DEFAULT '{}',
  mastered_concepts TEXT[] NOT NULL DEFAULT '{}',
  last_reward JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_state TO authenticated;
GRANT ALL ON public.player_state TO service_role;
ALTER TABLE public.player_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own player state" ON public.player_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== mission_attempts ==========
CREATE TABLE public.mission_attempts (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  correct INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  xp INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_attempts TO authenticated;
GRANT ALL ON public.mission_attempts TO service_role;
ALTER TABLE public.mission_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own attempts" ON public.mission_attempts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX mission_attempts_user_idx ON public.mission_attempts(user_id, created_at DESC);

-- ========== documents ==========
CREATE TABLE public.documents (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own documents" ON public.documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX documents_user_idx ON public.documents(user_id, created_at DESC);

-- ========== updated_at trigger ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER player_state_updated_at BEFORE UPDATE ON public.player_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== leaderboard view (safe columns only) ==========
CREATE VIEW public.leaderboard WITH (security_invoker = off) AS
SELECT
  ps.user_id,
  COALESCE(NULLIF(pr.display_name, ''), NULLIF(ps.avatar->>'name', ''), 'Aspirante') AS name,
  ps.avatar->>'classId' AS class_id,
  ps.points,
  ps.xp
FROM public.player_state ps
LEFT JOIN public.profiles pr ON pr.id = ps.user_id
WHERE ps.has_profile = true;
GRANT SELECT ON public.leaderboard TO anon, authenticated;
