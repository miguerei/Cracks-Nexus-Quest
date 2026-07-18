
DROP FUNCTION IF EXISTS public.get_leaderboard(INT);

CREATE TABLE public.public_scores (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Aspirante',
  class_id TEXT,
  points INT NOT NULL DEFAULT 0,
  xp INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.public_scores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_scores TO authenticated;
GRANT ALL ON public.public_scores TO service_role;
ALTER TABLE public.public_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scores" ON public.public_scores
  FOR SELECT USING (true);
CREATE POLICY "Users insert own score" ON public.public_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own score" ON public.public_scores
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own score" ON public.public_scores
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX public_scores_points_idx ON public.public_scores(points DESC, xp DESC);

CREATE TRIGGER public_scores_updated_at BEFORE UPDATE ON public.public_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
