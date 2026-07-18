import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, ArrowRight, LogIn } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameFrame } from "@/components/game/GameFrame";
import { GameButton } from "@/components/game/GameButton";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";

type AuthSearch = { redirect?: string };

/** Only allow same-origin relative paths as post-login destinations. */
function safeRedirect(value: unknown): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/hub";
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const user = useAuthStore((s) => s.user);
  const dest = safeRedirect(redirect);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in? Move along to the destination.
  useEffect(() => {
    if (user) navigate({ to: dest });
  }, [user, dest, navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName.trim() || undefined },
          },
        });
        if (error) throw error;
        toast.success("¡Cuenta creada!", { description: "Bienvenido a Cracks Academy." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("¡Sesión iniciada!");
      }
      // The auth listener will hydrate the player; navigate optimistically.
      navigate({ to: dest });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo completar. Inténtalo de nuevo.";
      toast.error("Ups", { description: message });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (loading) return;
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("No se pudo entrar con Google", {
        description: result.error instanceof Error ? result.error.message : String(result.error),
      });
      setLoading(false);
      return;
    }
    if (result.redirected) return; // browser is navigating away
    // Session already set in the preview iframe flow.
    navigate({ to: dest });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <StarField />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-6 text-center">
          <Link to="/" className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent backdrop-blur glow-primary">
            <Sparkles className="h-3.5 w-3.5" /> Cracks Academy
          </Link>
          <h1 className="text-3xl font-black">
            {mode === "login" ? "Entra al " : "Únete a "}
            <span className="text-gradient-nexus">Nexus</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Guarda tu progreso, cristales y ranking en la nube."
              : "Crea tu cuenta y compite en el ranking real del Nexus."}
          </p>
        </div>

        <GameFrame glow="primary" className="space-y-5">
          <GameButton onClick={handleGoogle} variant="ghost" size="lg" className="w-full" disabled={loading}>
            <GoogleGlyph /> Continuar con Google
          </GameButton>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> o con tu correo <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            {mode === "signup" && (
              <Field
                label="Nombre de Aspirante"
                icon={<Sparkles className="h-4 w-4" />}
                value={displayName}
                onChange={setDisplayName}
                placeholder="Tu nombre de héroe"
                type="text"
              />
            )}
            <Field
              label="Correo"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={setEmail}
              placeholder="tu@correo.com"
              type="email"
              required
            />
            <Field
              label="Contraseña"
              icon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={setPassword}
              placeholder="Mínimo 6 caracteres"
              type="password"
              required
            />

            <GameButton type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
              {mode === "login" ? <LogIn className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
              {loading ? "Un momento…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </GameButton>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="font-bold text-primary hover:underline"
            >
              {mode === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </GameFrame>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Puedes seguir jugando como invitado desde{" "}
          <Link to="/" className="text-accent hover:underline">la portada</Link>.
        </p>
      </motion.div>
    </div>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type,
  required,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-2 rounded-xl border border-input bg-background/60 px-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40">
        <span className="text-muted-foreground">{icon}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          required={required}
          className="w-full bg-transparent py-3 outline-none"
        />
      </span>
    </label>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
