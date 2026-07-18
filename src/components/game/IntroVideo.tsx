import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SkipForward, Volume2, VolumeX } from "lucide-react";
import { INTRO_VIDEO } from "@/lib/artbook";

/**
 * Cinemática de intro a pantalla completa. Se muestra al comenzar la aventura.
 * Intenta reproducir con sonido (permitido porque se dispara con un gesto del
 * usuario); si el navegador lo bloquea, cae a modo silenciado. El jugador puede
 * saltarla en cualquier momento con el botón "Saltar".
 */
export function IntroVideo({ onFinish }: { onFinish: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onFinish();
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      // Autoplay con sonido bloqueado: reintenta en silencio.
      v.muted = true;
      setMuted(true);
      v.play().catch(() => finish());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] grid place-items-center bg-black"
    >
      <video
        ref={videoRef}
        src={INTRO_VIDEO}
        className="h-full w-full object-contain"
        playsInline
        autoPlay
        onEnded={finish}
        onError={finish}
      />

      {/* Viñeta cinematográfica sutil */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

      <div className="absolute right-4 top-4 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Activar sonido" : "Silenciar"}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white/90 backdrop-blur transition hover:bg-black/70"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={finish}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-black/70"
        >
          Saltar <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
