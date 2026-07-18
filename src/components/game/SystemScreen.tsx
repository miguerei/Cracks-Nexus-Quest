import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { cn } from "@/lib/utils";

export type SystemScreenProps = {
  /** Decorative icon or emoji shown in the badge (not critical info). */
  icon?: React.ReactNode;
  /** Show a spinning ring instead of a static icon (loading/hydration). */
  spin?: boolean;
  /** Short, in-universe title. */
  title: string;
  /** One or two sentences, videogame tone — never technical. */
  message: string;
  /** Optional Nova line for extra warmth. */
  novaMessage?: string;
  novaMood?: "happy" | "hint" | "celebrate";
  /** CTA buttons/links, rendered below the message. Keep route typing safe. */
  children?: React.ReactNode;
  /** Visual accent of the badge. */
  tone?: "neutral" | "primary" | "gold";
};

/**
 * Shared full-screen state for empty, blocked, loading and system moments.
 * Keeps every "nothing here yet" screen warm and on-theme so the app never
 * feels broken, cold or technical. Purely presentational.
 */
export function SystemScreen({
  icon,
  spin,
  title,
  message,
  novaMessage,
  novaMood = "hint",
  children,
  tone = "neutral",
}: SystemScreenProps) {
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <StarField density={70} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <div
          className={cn(
            "mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full border-2",
            tone === "primary" && "border-primary/50 bg-card glow-primary",
            tone === "gold" && "border-gold/50 bg-card",
            tone === "neutral" && "border-border bg-background/70",
          )}
        >
          {spin ? (
            <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <span className="text-4xl" aria-hidden="true">
              {icon}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-black">{title}</h1>
        <p className="mx-auto mt-1 max-w-sm text-muted-foreground">{message}</p>

        {novaMessage && (
          <div className="mt-6 text-left">
            <NovaBubble mood={novaMood} message={novaMessage} />
          </div>
        )}

        {children && <div className="mt-6 flex flex-col gap-3 sm:flex-row">{children}</div>}
      </motion.div>
    </div>
  );
}
