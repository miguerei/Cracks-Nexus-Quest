import { cn } from "@/lib/utils";

export function AvatarDisc({
  base,
  color,
  emblem,
  hair,
  outfit,
  image,
  size = 64,
  className,
}: {
  base: string;
  color: string;
  emblem?: string;
  hair?: string;
  outfit?: string;
  /** Optional hero portrait shown instead of the emoji base. */
  image?: string;
  size?: number;
  className?: string;
}) {
  const inner = outfit ?? "oklch(0.2 0.05 275)";
  return (
    <div
      className={cn("relative grid place-items-center overflow-hidden rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: image ? "oklch(0.16 0.045 275)" : `radial-gradient(circle at 30% 30%, ${color}, ${inner})`,
        boxShadow: `0 0 24px -6px ${color}`,
        border: `2px solid ${color}`,
      }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <>
          <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{base}</span>
          {hair ? (
            <span className="absolute -left-1 -top-1" style={{ fontSize: size * 0.3 }}>
              {hair}
            </span>
          ) : null}
        </>
      )}
      {emblem ? (
        <span
          className="absolute -right-1 -top-1 grid place-items-center rounded-full bg-background/70 backdrop-blur"
          style={{ fontSize: size * 0.28, width: size * 0.4, height: size * 0.4 }}
        >
          {emblem}
        </span>
      ) : null}
    </div>
  );
}
