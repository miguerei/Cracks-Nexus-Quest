
DROP VIEW IF EXISTS public.leaderboard;

CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  class_id TEXT,
  points INT,
  xp INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ps.user_id,
    COALESCE(NULLIF(pr.display_name, ''), NULLIF(ps.avatar->>'name', ''), 'Aspirante') AS name,
    ps.avatar->>'classId' AS class_id,
    ps.points,
    ps.xp
  FROM public.player_state ps
  LEFT JOIN public.profiles pr ON pr.id = ps.user_id
  WHERE ps.has_profile = true
  ORDER BY ps.points DESC, ps.xp DESC
  LIMIT GREATEST(limit_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(INT) TO anon, authenticated;
