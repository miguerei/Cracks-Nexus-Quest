// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * El tagger dev de Lovable/TanStack inyecta `data-tsd-source` en TODOS los JSX.
 * react-three-fiber interpreta los guiones como rutas anidadas (data.tsd.source)
 * y revienta el <Canvas> en cada commit. Este plugin (post) limpia ese atributo
 * SOLO en los ficheros de la escena 3D; el resto de la app sigue taggeada.
 */
const stripTsdSourceFromR3F = () => ({
  name: "strip-tsd-source-world3d",
  enforce: "post" as const,
  transform(code: string, id: string) {
    if (!id.includes("/components/game/world3d/")) return;
    if (!code.includes("data-tsd-source")) return;
    // Consume la coma POSTERIOR: el atributo puede ser la primera prop del
    // objeto compilado ({tsd, resto}) y un `{, resto}` no parsea. Un posible
    // `{resto, }` residual sí es JS válido.
    return { code: code.replace(/"data-tsd-source":\s*"[^"]*"\s*,?/g, ""), map: null };
  },
});

export default defineConfig({
  vite: { plugins: [stripTsdSourceFromR3F()] },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
