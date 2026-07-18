import { motion } from "framer-motion";
import { NovaAvatar } from "./NovaAvatar";

export function NovaBubble({ message, mood = "happy" }: { message: string; mood?: "happy" | "hint" | "celebrate" }) {
  const badge = mood === "celebrate" ? "🎉" : mood === "hint" ? "💡" : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3"
    >
      <div className="relative shrink-0">
        <NovaAvatar variant="icon" size={48} />
        {badge ? (
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-border bg-card text-[11px] shadow-deep">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="relative rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm shadow-deep">
        <span className="mb-0.5 block text-xs font-semibold text-accent">Nova</span>
        {message}
      </div>
    </motion.div>
  );
}
