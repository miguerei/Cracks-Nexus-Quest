# Fase 4-B — Personaje 3D elegible + sensación de videojuego (estilo Hogwarts Legacy)

## Objetivo
Que el mundo 3D se sienta como un videojuego real: tu **Aspirante** (uno de los 5 héroes de clase que ya se eligen en Crear Avatar) aparece en 3D con su aspecto y color, camina por los mundos, se cruza con NPCs con forma humanoide, y tiene una **barra de comandos** clara para saltar, lanzar energía, interactuar y abrir un **menú de pausa/misiones**. Sin tocar backend, lógica de retos, gating ni recompensas.

## Qué se mantiene intacto
- Gating secuencial de misiones y desbloqueo de mundos (`getMissionsWithStatus`, `getWorldProgress`).
- Recompensas idempotentes, `useChallengeGuard`, `useFinishChallenge`, rutas de reto.
- Fallback 2D (`PlayableWorldScreen`) si WebGL falla y carga *client-only*.
- Sin IA real, sin nuevos mundos ni minijuegos, sin cambiar branding.

## 1. Héroe 3D con forma de personaje (no cápsula)
En `World3DScene.tsx`, sustituir la cápsula por un **humanoide estilizado low-poly** construido con primitivas de three (torso, cabeza, brazos, piernas, capa/manto luminoso) — coherente con la estética del Art Bible (semi-realista juvenil, fantasía tecnológica), sin fotorrealismo.
- El color y el acento salen de la **clase elegida** (`avatar.color` ya llega; añadir el emblema/tono de clase).
- Animación de caminar sencilla (balanceo de brazos/piernas por velocidad), idle flotante, y giro hacia la dirección de avance (ya existe `facing`).
- Aura de energía del conocimiento con el color de la clase (ya hay `pointLight`).

## 2. Silueta por clase
Pequeña variación visual por `classId` (Explorador, Estratega, Sabio, Velocista, Constructor): acento de color, un detalle de silueta (p. ej. capa larga para Sabio, visor para Constructor) y el aura. Config en `worldConfig.ts` (`HERO_LOOKS`), 100% presentacional.

## 3. NPCs y rival humanoides
Los nodos `npc` y `rival` pasan de icosaedro a un humanoide simplificado (reutilizando el mismo builder del héroe con paleta distinta), para que "aparezcan NPCs" con forma reconocible. Cristales de misión y portales se mantienen como están.

## 4. Barra de comandos tipo videojuego (HUD)
Rediseño del HUD sobre el canvas (DOM, ya existe la base):
- **Joystick** (móvil) + **WASD/flechas** (escritorio) — ya está.
- **Saltar** (Espacio / botón) — ya está.
- **Lanzar** (tecla F / botón): dispara un **pulso de energía** visual desde el héroe (proyectil emisivo con el color de la clase) — puro efecto, no daña ni cambia estado. Da la sensación de "lanzar algo".
- **Interactuar** (E / botón Acción) — ya está.
- **Menú** (Esc / botón ☰): abre un **overlay de pausa** con: lista de misiones del mundo y su estado, botón Volver al mapa, Ranking y Perfil. Pausa el movimiento (reutiliza el flag `paused`).
- Leyenda de teclas visible y responsive (móvil sin overflow horizontal).

## 5. Coherencia con la intro
El menú y los estados usan la misma paleta/energía del vídeo de intro (azul del conocimiento, glow), reforzando la continuidad "intro cinemática → juego".

## Sección técnica
- Todo en `src/components/game/world3d/` (`World3DScene.tsx`, `World3DScreen.tsx`, `worldConfig.ts`); nada nuevo en el grafo SSR fuera de `<ClientOnly>`.
- Nuevo componente `HeroModel` (grupo de meshes) reutilizado para héroe/NPC/rival con props de color y variante.
- Nuevo estado `casting` + componente `EnergyBolt` en la escena para el efecto de "lanzar"; se autolimpia con temporizador.
- El menú de pausa es un componente DOM (`WorldMenu`) montado en `World3DScreen`, sin lógica de juego: solo navega y lista misiones ya calculadas.
- `controlsRef` se amplía con `cast: boolean`; teclado añade F (lanzar) y Esc (menú).
- Verificación: `tsgo --noEmit` limpio + smoke-test Playwright (canvas monta, héroe con forma, botones Lanzar/Menú funcionan, menú lista misiones, sin overflow móvil).

## Fuera de alcance
No se cargan modelos GLTF externos ni Gaussian Splatting (descartado como motor). El personaje es construido por nosotros con primitivas, como se aprobó para tener control total de gameplay.
