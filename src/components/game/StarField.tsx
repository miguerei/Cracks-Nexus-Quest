import { useEffect, useState } from "react";

type Star = { id: number; top: number; left: number; size: number; delay: number; dur: number };

export function StarField({ density = 60 }: { density?: number }) {
  const [stars, setStars] = useState<Star[]>([]);

  // Generate stars only on the client to avoid SSR hydration mismatches
  // (Math.random() differs between server and client renders).
  useEffect(() => {
    setStars(
      Array.from({ length: density }).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 4,
        dur: Math.random() * 3 + 2,
      })),
    );
  }, [density]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-hero">
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-foreground"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
    </div>
  );
}
