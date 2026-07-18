import { Link } from "@tanstack/react-router";
import { Gem, Coins, Flame, Home, UserCircle } from "lucide-react";
import { usePlayerStore, usePlayerDerived } from "@/store/usePlayerStore";
import { useAuthStore } from "@/store/useAuthStore";
import { getLeagues, xpIntoLevel } from "@/services/gameService";
import { AvatarDisc } from "@/components/game/AvatarDisc";
import { heroPortrait } from "@/lib/artbook";

const LEAGUES = getLeagues();

export function GameHud() {
  const { avatar, xp, crystals, coins, streak } = usePlayerStore();
  const { level, league } = usePlayerDerived();
  const isSignedIn = useAuthStore((s) => !!s.user);
  const { current, needed } = xpIntoLevel(xp);
  const pct = Math.round((current / needed) * 100);
  const lg = LEAGUES[league];


  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2 sm:px-4">
        <Link to="/hub" className="flex items-center gap-2">
          <AvatarDisc base={avatar.base} color={avatar.color} hair={avatar.hair} outfit={avatar.outfit} emblem={avatar.emblem} image={heroPortrait(avatar.classId)} size={40} />
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight">{avatar.name}</p>
            <p className="text-xs text-muted-foreground">Nivel {level}</p>
          </div>
        </Link>

        <div className="hidden min-w-32 flex-1 md:block">
          <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>XP</span>
            <span>{current}/{needed}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-energy transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span
            className="hidden items-center rounded-full px-2 py-1 text-xs font-bold sm:inline-flex"
            style={{ background: `${lg.color}22`, color: lg.color, border: `1px solid ${lg.color}55` }}
          >
            {lg.name}
          </span>
          <Stat icon={<Flame className="h-4 w-4 text-orange-400" />} value={streak} />
          <Stat icon={<Gem className="h-4 w-4 text-accent" />} value={crystals} />
          <Stat icon={<Coins className="h-4 w-4 text-gold" />} value={coins} />
          <Link
            to="/hub"
            className="grid h-9 w-9 place-items-center rounded-full bg-card text-muted-foreground transition hover:text-foreground"
            aria-label="Ir al Hub"
          >
            <Home className="h-4 w-4" />
          </Link>
          <Link
            to="/cuenta"
            className={`relative grid h-9 w-9 place-items-center rounded-full bg-card transition hover:text-foreground ${isSignedIn ? "text-energy" : "text-muted-foreground"}`}
            aria-label="Tu cuenta"
          >
            <UserCircle className="h-4 w-4" />
            {isSignedIn && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-energy" />
            )}
          </Link>

        </div>
      </div>
    </header>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-sm font-semibold tabular-nums">
      {icon}
      {value}
    </span>
  );
}
