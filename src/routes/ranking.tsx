import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Flame, TrendingUp, Target, ArrowUp, Crown, Swords } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameHud } from "@/components/hud/GameHud";
import { GameFrame } from "@/components/game/GameFrame";
import { GameButton } from "@/components/game/GameButton";
import { CrystalIcon } from "@/components/game/CrystalIcon";
import {
  fetchLeaderboard,
  getLeaderboard,
  getLeagues,
  leagueForPoints,
  levelForXp,
  getPlayerClasses,
  getClassById,
  type LeaderboardEntry,
  type LeagueId,
  getCurrentWorldId,
} from "@/services/gameService";
import { usePlayerStore, usePlayerDerived } from "@/store/usePlayerStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ARTBOOK } from "@/lib/artbook";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ranking")({
  component: Ranking,
});

const LEAGUE_ORDER: LeagueId[] = ["bronce", "plata", "oro", "diamante", "leyenda"];

function Ranking() {
  const { avatar, points, streak, attempts } = usePlayerStore();
  const missionsCleared = usePlayerStore((s) => s.missionsCleared);
  const worldsCleared = usePlayerStore((s) => s.worldsCleared);
  const mundoActual = getCurrentWorldId({ worldsCleared, missionsCleared });
  const { level } = usePlayerDerived();
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const [filter, setFilter] = useState<string>("all");

  // Real ranking from the Cloud. Refetches on window focus and every 30s.
  const { data: remoteScores = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchLeaderboard(100),
    staleTime: 30_000,
  });

  const totalAns = attempts.reduce((a, b) => a + b.total, 0);
  const totalCorrect = attempts.reduce((a, b) => a + b.correct, 0);
  const accuracy = totalAns > 0 ? Math.round((totalCorrect / totalAns) * 100) : 100;
  const weeklyGain = points;

  const player: LeaderboardEntry = {
    id: "me",
    name: avatar.name,
    avatar: avatar.emblem || avatar.base,
    color: avatar.color,
    classId: avatar.classId,
    points,
    level,
    streak,
    weeklyGain,
    accuracy,
    isPlayer: true,
  };

  // Map remote scores into rich entries; drop my own remote row so the local
  // (richer) player entry represents me exactly once.
  const remoteRows: LeaderboardEntry[] = remoteScores
    .filter((r) => r.user_id !== myUserId)
    .map((r) => {
      const rcls = getClassById(r.class_id ?? "explorador");
      return {
        id: r.user_id,
        name: r.name,
        avatar: rcls.emoji,
        color: rcls.color,
        classId: rcls.id,
        points: r.points,
        level: levelForXp(r.xp),
        streak: 0,
        weeklyGain: 0,
        accuracy: 100,
        isPlayer: false,
      };
    });

  // Tablero completo con el jugador real. En modo local (sin nube) la lista
  // remota viene vacía: usamos la clase de ejemplo para que la competición
  // siga teniendo sentido (QA B4) — el jugador es la única fila real.
  const baseRows = remoteRows.length > 0 ? remoteRows : getLeaderboard().filter((r) => !r.isPlayer);
  const all = [...baseRows, player].sort((a, b) => b.points - a.points);
  const rows = filter === "all" ? all : all.filter((r) => r.classId === filter || r.isPlayer);


  const playerIndex = all.findIndex((r) => r.isPlayer);
  const playerRank = playerIndex + 1;

  // Who is right above the player, and how far away.
  const rival = playerIndex > 0 ? all[playerIndex - 1] : null;
  const pointsToOvertake = rival ? Math.max(1, rival.points - points + 1) : 0;

  // League standing + progress to the next league.
  const myLeagueId = leagueForPoints(points);
  const myLeague = getLeagues()[myLeagueId];
  const nextLeagueId = LEAGUE_ORDER[LEAGUE_ORDER.indexOf(myLeagueId) + 1];
  const nextLeague = nextLeagueId ? getLeagues()[nextLeagueId] : null;
  const pointsToNextLeague = nextLeague ? Math.max(0, nextLeague.min - points) : 0;
  const leagueProgress = nextLeague
    ? Math.min(100, Math.round(((points - myLeague.min) / (nextLeague.min - myLeague.min)) * 100))
    : 100;

  // Which class is dominating the whole board (by total points).
  const classTotals = new Map<string, number>();
  all.forEach((r) => classTotals.set(r.classId, (classTotals.get(r.classId) ?? 0) + r.points));
  let dominantId = all[0].classId;
  let dominantMax = -1;
  classTotals.forEach((v, k) => {
    if (v > dominantMax) {
      dominantMax = v;
      dominantId = k;
    }
  });
  const dominantClass = getClassById(dominantId);
  const playerLeadsClass = dominantId === avatar.classId;

  return (
    <div className="relative min-h-screen">
      <StarField />
      <GameHud />

      {/* Atmósfera del Key Art (Art Bible), muy tenue para no dañar legibilidad. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img
          src={ARTBOOK.keyArt}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-full w-full object-cover object-top opacity-[0.08]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* A. Cabecera competitiva — Liga semanal del Nexus */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <GameFrame glow="gold" className="overflow-hidden">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-gold text-gold-foreground glow-gold">
                <Trophy className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-gold">Liga semanal del Nexus</p>
                <h1 className="text-2xl font-black leading-tight sm:text-3xl">Ranking del Nexus</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Compite, gana puntos y adelanta Aspirantes.
                </p>
              </div>
            </div>
          </GameFrame>
        </motion.div>

        {/* Featured: your competitive standing */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <GameFrame glow="primary" className="bg-gradient-to-br from-primary/15 via-card/70 to-card/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">Tu posición semanal</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-black tabular-nums">#{playerRank}</span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ background: `${myLeague.color}22`, color: myLeague.color }}
                  >
                    Liga {myLeague.name}
                  </span>
                </p>
              </div>
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-2xl"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${player.color}, oklch(0.2 0.05 275))`,
                  border: `2px solid ${player.color}`,
                }}
              >
                {player.avatar}
              </div>
            </div>

            {/* Who to overtake next */}
            <div className="mt-4 rounded-2xl border border-border/60 bg-background/40 p-3">
              {rival ? (
                <p className="flex items-center gap-2 text-sm">
                  <Swords className="h-4 w-4 shrink-0 text-orange-400" />
                  <span>
                    Te faltan <span className="font-black text-energy tabular-nums">{pointsToOvertake}</span> puntos para
                    adelantar a <span className="font-bold">{rival.name}</span>
                  </span>
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm">
                  <Crown className="h-4 w-4 shrink-0 text-gold" />
                  <span className="font-bold">¡Lideras el ranking! Defiende tu puesto.</span>
                </p>
              )}
            </div>

            {/* Next league progress */}
            {nextLeague && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Camino a Liga {nextLeague.name}</span>
                  <span className="font-semibold text-foreground">Faltan {pointsToNextLeague} pts</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background/60">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: nextLeague.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${leagueProgress}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </div>
            )}

            {/* Dominant class + CTA */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1 text-xs">
                <Crown className="h-3.5 w-3.5 text-gold" />
                Clase dominante:
                <span className="font-bold" style={{ color: dominantClass.color }}>
                  {dominantClass.emoji} {dominantClass.name}
                </span>
                {playerLeadsClass && <span className="text-[10px] font-bold text-energy">· ¡la tuya!</span>}
              </span>
              <GameButton asChild size="sm" variant="primary">
                <Link to="/mundo/$worldId" params={{ worldId: mundoActual }}>
                  <ArrowUp className="h-4 w-4" /> Jugar otra partida
                </Link>
              </GameButton>
            </div>
          </GameFrame>
        </motion.div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <Kpi icon={<Trophy className="h-4 w-4 text-gold" />} value={`#${playerRank}`} label="Tu posición" />
          <Kpi icon={<TrendingUp className="h-4 w-4 text-energy" />} value={`+${weeklyGain}`} label="Mejora semanal" />
          <Kpi icon={<Target className="h-4 w-4 text-accent" />} value={`${accuracy}%`} label="Precisión" />
        </div>

        {/* Class filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todas</FilterChip>
          {getPlayerClasses().map((c) => (
            <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.emoji} {c.name}
            </FilterChip>
          ))}
        </div>

        <div className="space-y-2">
          {rows.map((r, idx) => {
            const lg = getLeagues()[leagueForPoints(r.points)];
            const rcls = getClassById(r.classId);
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;
            const isRival = rival?.id === r.id;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 backdrop-blur bevel-highlight",
                  r.isPlayer
                    ? "border-primary bg-primary/10 ring-1 ring-ring/40 glow-primary"
                    : isRival
                      ? "border-orange-400/50 bg-orange-400/5"
                      : "border-border bg-card/50",
                )}
              >
                <span className="w-8 text-center text-lg font-black tabular-nums">{medal}</span>
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl"
                  style={{ background: `radial-gradient(circle at 30% 30%, ${r.color}, oklch(0.2 0.05 275))`, border: `2px solid ${r.color}` }}
                >
                  {r.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {r.name} {r.isPlayer && <span className="text-xs text-primary">(tú)</span>}
                    {isRival && <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-400"><Swords className="h-3 w-3" />a tiro</span>}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span style={{ color: rcls.color }}>{rcls.emoji} {rcls.name}</span>
                    <span className="inline-flex items-center gap-0.5"><Flame className="h-3 w-3 text-orange-400" />{r.streak}</span>
                    <span className="inline-flex items-center gap-0.5 text-energy"><TrendingUp className="h-3 w-3" />+{r.weeklyGain}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <CrystalIcon kind="points" size="sm" glow={false} />
                  <div>
                    <p className="font-black tabular-nums">{r.points}</p>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${lg.color}22`, color: lg.color }}>
                      {lg.name}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active ? "border-primary bg-primary/15 text-primary" : "border-border bg-card/50 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Kpi({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <GameFrame className="p-3 text-center">
      <div className="mx-auto mb-1 grid h-8 w-8 place-items-center rounded-lg bg-background/60">{icon}</div>
      <p className="text-xl font-black">{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
    </GameFrame>
  );
}
