# Art Bible — Cracks Academy: Nexus Quest (Fase 5)

Fuente canónica: `intro.mp4` (10 s) + póster oficial + style guide oficial.
TODO trabajo visual del juego debe poder justificarse con este documento.

## 1. Tono

Fantasía luminosa y aspiracional. Academia donde el conocimiento es poder:
tecnología antigua + magia. Contrastes épicos entre LUZ (azul/dorado) y VACÍO
(violeta/negro). Juvenil, épico, nunca oscuro-deprimente: el Vacío amenaza,
los héroes brillan.

## 2. Paleta maestra

| Rol | Hex | Uso |
|---|---|---|
| Azul energía del conocimiento | `#38bdf8` / `#3b82f6` | hechizos, cristales, runas, UI |
| Azul profundo | `#1e3a6e` | ropa héroes, sombras frías |
| Cian holo | `#7dd3fc` | interfaces holográficas, retículas |
| Violeta del Vacío | `#a855f7` / `#7c3aed` | enemigos, zonas selladas, jefe |
| Negro Vacío | `#1a1028` | cuerpo de criaturas del Vacío |
| Dorado de recompensa | `#f4c542` / `#b98a3a` | halos, marcos, botines, énfasis |
| Verde Bosque | `#2e6b3c` / `#7fae4c` | vegetación |
| Blanco mágico | `#eaf6ff` | núcleos de luz, destellos |
| Piedra antigua | `#8d927e` / `#6f7462` | ruinas (siempre con musgo y runas azules) |

## 3. Materiales (style guide §2)

Cristales luminosos (emisivos, bloom), metal tecnológico con inserciones azules,
piedra antigua rúnica con musgo, madera mágica, interfaces holográficas
translúcidas cian (paneles flotantes con líneas de circuito).

## 4. Las 5 clases (identidad del póster — CANON)

| Clase | Silueta/props | Paleta ropa | Firma |
|---|---|---|---|
| **Explorador** | gafas de aventurero EN LA FRENTE, mochila, pose agachada lista | verde oliva `#6b7a45` + marrón cuero `#7a5c3a` | guantelete azul brillante |
| **Estratega** | coleta azul larga, capa azul/blanca con dorado, falda + botas altas | azul marino `#24457a` + blanco `#e8ecf4` + dorado | PANEL HOLOGRÁFICO cian en la mano izquierda |
| **Sabio** | gafas redondas, túnica blanca/azul con bordados dorados, bastón con cristal azul en trident dorado | blanco + azul + dorado | LIBRO abierto irradiando energía |
| **Velocista** | banda azul en la frente, pelo puntas, chaqueta deportiva azul con capucha | azul eléctrico `#2563b0` + negro | RAYOS azules en los puños |
| **Constructor** | rastas + gafas de soldador arriba, top blanco/amarillo, guantelete mecánico | amarillo `#e8b13a` + blanco + marrón | ESCUDO rúnico circular gigante con núcleo azul |

Proporciones juveniles estilizadas (~5.5 cabezas), sonrisa confiada, ojos grandes.

## 5. Nova (mascota — CANON del vídeo)

Criatura mágica azul translúcida tipo zorrito-espíritu: cuerpo rechoncho que
irradia luz, DOS OREJAS grandes puntiagudas, cola pequeña, ojos negros enormes
brillantes, boca abierta feliz, mejillas rosadas. Flota con aro de energía.
Emociones físicas: celebra dando volteretas, se esconde tras el héroe ante el
Vacío, se inclina curiosa hacia los cristales.

## 6. El Vacío (antagonista)

Coloso de obsidiana angulosa (cuernos, hombreras de púas), NÚCLEO violeta
pulsante en el pecho (su punto débil — las retículas apuntan ahí), ojos violeta,
aura de humo negro-violeta. Las zonas selladas usan su niebla.

## 7. Lenguaje de movimiento (del vídeo)

- **Cast**: anticipación (retroceso 150 ms) → proyección de manos/prop hacia
  delante con ARCO ELÉCTRICO azul → proyectil cristalino con estela → impacto
  = destello + anillos de onda + partículas ascendentes.
- **Respuesta correcta = hechizo del héroe** (la mecánica ES el disparo).
- **Fallo = pulso del Vacío** hacia el héroe (niebla violeta, sacudida).
- Enemigos flotan/laten lentamente; su núcleo pulsa al ritmo de amenaza.
- Retícula de fijado cian sobre el objetivo activo (anillos + cruz).
- Héroes en reposo: peso en una pierna, micro-respiración, props vivos
  (holograma parpadea, libro pasa páginas, rayos chisporrotean).

## 8. Mundos (biomas por Núcleo del Saber)

| worldId | Bioma | Paleta ambiental | Firmas |
|---|---|---|---|
| bosque | Bosque del Descubrimiento (HECHO Fase 4-B) | verdes + oro tarde | ruinas, río, árboles gigantes |
| algoritmos | Ciudadela circuito | azules fríos + cian | torres de datos, puentes de luz, suelo rúnico-circuito |
| cronicas | Desierto dorado de las Crónicas | arena + oro + atardecer | obeliscos, estatuas colosales, dunas, estandartes |
| laboratorio | Cavernas de cristal | violeta claro + rosa + azul | cristales gigantes, setas luminosas, alambiques |
| lenguas | Archipiélago de las Mareas | teal + turquesa + coral | islotes, faros-runa, agua por todas partes |
| observatorio | Plataformas astrales | índigo + estrellas + plata | anillos orbitales, telescopios, cielo nocturno |
| fortaleza-vacio | Fortaleza del Vacío | violeta/negro + magma frío | púas de obsidiana, niebla, el único mundo "oscuro" |

Cada mundo conserva la GRAMÁTICA del bosque: entrada clara → ruta legible →
hito (equiv. puente) → zona de misiones → claro social (NPC/rival) → portal →
altar del jefe con tinte del Vacío.

## 9. Reglas técnicas

- Todo procedural (primitivas low-poly flatShading + shaders pequeños + canvas
  textures). CERO assets externos. Determinista (mulberry32, nunca Math.random
  en construcción de escena).
- Emissive ≥ 1.2 para que entre en Bloom (threshold 1). El Vacío emite ~0.6
  (amenaza sorda, no brillo alegre).
- Instancing para vegetación/rocas; luces puntuales SOLO en héroe/Nova/nodo
  activo/proyectiles.
- Los ficheros JSX de escenas 3D deben vivir bajo `src/components/game/world3d/`
  (el plugin de vite.config limpia `data-tsd-source` solo ahí; fuera, el Canvas
  revienta en dev).
