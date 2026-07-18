import { cn } from "@/lib/utils";
import { ARTBOOK } from "@/lib/artbook";

/**
 * NovaAvatar — retrato oficial reutilizable de Nova, el companion del Nexus.
 *
 * Presentacional puro. Usa el asset oficial (`/artbook/nova-companion.webp`)
 * con aura azul/cian de energía del conocimiento. Dos variantes:
 *  - `variant="full"` — cuerpo completo, para paneles y portraits de diálogo.
 *  - `variant="icon"` — recorte de cabeza en disco, para el HUD y avatares
 *    pequeños junto a los mensajes.
 */
export function NovaAvatar({
  size = 64,
  variant = "full",
  float = true,
  className,
}: {
  size?: number;
  variant?: "full" | "icon";
  float?: boolean;
  className?: string;
}) {
  if (variant === "icon") {
    return (
      <span
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-full",
          float && "animate-float-slow",
          className,
        )}
        style={{
          width: size,
          height: size,
          background: "radial-gradient(circle at 50% 35%, oklch(0.32 0.09 250), oklch(0.16 0.05 265))",
          boxShadow: "0 0 18px -4px oklch(0.72 0.16 230 / 0.7)",
          border: "1.5px solid oklch(0.72 0.16 230 / 0.6)",
        }}
      >
        <img
          src={ARTBOOK.novaIcon}
          alt="Nova"
          loading="lazy"
          className="h-full w-full scale-110 object-cover object-top"
        />
      </span>
    );
  }

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full blur-xl"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.16 230 / 0.5), transparent 70%)" }}
      />
      <img
        src={ARTBOOK.nova}
        alt="Nova, tu companion del Nexus"
        loading="lazy"
        className={cn(
          "relative h-full w-full object-contain drop-shadow-[0_0_14px_oklch(0.72_0.16_230/0.6)]",
          float && "animate-float-slow",
        )}
      />
    </span>
  );
}
