---
name: nexus-art-pass
description: Orquesta un pase de arte/movimiento coordinado sobre Nexus Quest — dirección de arte central (art bible) + oleadas paralelas de especialistas con propiedad de ficheros disjunta y gate de integración final.
---

# Nexus Art Pass — flujo del equipo

Roles (personas en `.claude/agents/`): **art director** (la sesión principal:
define contratos, reparte ficheros, verifica en navegador y da el gate),
**character-artist**, **environment-artist**, **encounter-designer**.

## Flujo

1. **Dirección**: el art director actualiza `docs/art-bible-nexus.md` con
   cualquier fuente nueva (vídeo/póster) ANTES de lanzar oleadas. La biblia
   es el único canon; los agentes no inventan dirección.
2. **Contratos**: si dos agentes comparten una API nueva, el contrato exacto
   (nombres, tipos, fichero) va escrito en AMBOS prompts + fallback guardado
   en el consumidor. Nunca asumir convergencia espontánea.
3. **Propiedad disjunta**: cada agente recibe una lista cerrada de ficheros.
   Nadie toca ficheros de otro. Nuevos módulos 3D SIEMPRE bajo
   `src/components/game/world3d/` (filtro anti data-tsd-source de vite.config).
4. **Oleada**: agentes en paralelo; cada uno termina con `npx vite build`
   verde y un informe de qué contratos expone.
5. **Gate de integración** (art director, obligatorio): revisar seams entre
   entregas, build verde, verificación EN NAVEGADOR con pestaña nueva
   (tabs_create; si sale negro: screenshot + wait + screenshot), consola sin
   errores, y screenshots de evidencia. Las lecciones de bugs van a la
   memoria del proyecto.

## Verificación en navegador (gotchas del harness)

- La pestaña de preview suele reportar document.hidden=true: crear SIEMPRE
  una pestaña nueva para cargar visible; el VisibilityFrameDriver mantiene la
  física con pestaña oculta.
- Movimiento sintético: dispatchEvent de KeyboardEvent sobre window funciona
  (keydown mantenido + keyup).
- La consola del harness repite errores antiguos: contrastar con el módulo
  servido (curl) antes de creer un error.
