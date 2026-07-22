// music.ts — música ambiental procedural por mundo (WebAudio, CERO assets).
//
// Motor hermano de sfx.ts: todo se sintetiza al vuelo (osciladores, envolventes,
// ruido filtrado, feedback-delay compartido para dar "sala"). El AudioContext se
// crea LAZY y SOLO tras un gesto del usuario (el click del toggle 🎵, o el primer
// pointerdown/keydown si la preferencia ya estaba activada de otra sesión).
// Preferencia persistida en localStorage; por DEFECTO la música está APAGADA
// (es una app de aula: nadie quiere que suene sola en clase).
//
// API:
//   music.enterWorld(worldId)              → tema ambiental del bioma (crossfade)
//   music.enterBattle(variant?, worldId?)  → tema del mundo + capa rítmica suave
//   music.stop(fadeMs?)                    → fundido de salida limpio
//   music.setOn(bool) / music.isOn()       → toggle persistido ("nexus:music-on")
//
// Composición: cada mundo tiene un loop de 8 compases (4/4) cuyo contenido se
// decide con un PRNG determinista sembrado por worldId + nº de compás — el loop
// siempre suena "igual pero nunca idéntico", sin cansar y sin Math.random.

export type MusicBattleVariant = "duelo" | "boss";

const STORAGE_KEY = "nexus:music-on";
const MASTER_GAIN = 0.25; // la música acompaña, no compite con los SFX
const FADE_S = 1.4; // crossfade entre mundos / entrada y salida de batalla

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let delayIn: GainNode | null = null; // entrada del feedback-delay compartido
let noiseBuf: AudioBuffer | null = null;

function leerPreferencia(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Default OFF: solo "on" explícito enciende (al revés que sfx).
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

let encendido = leerPreferencia();

/**
 * Crea (una vez) y reanuda el AudioContext + bus maestro + delay de feedback.
 * Debe invocarse SIEMPRE desde un gesto del usuario. null si no hay soporte.
 */
function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
      // "Sala" barata sin samples: delay con feedback amortiguado por lowpass.
      delayIn = ctx.createGain();
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.31;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.38;
      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 2400;
      delayIn.connect(delay);
      delay.connect(damp);
      damp.connect(feedback);
      feedback.connect(delay);
      damp.connect(master);
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

/** Buffer de ruido determinista compartido (LCG, semilla propia ≠ sfx). */
function ensureNoise(ac: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    const n = Math.floor(ac.sampleRate * 1.0);
    noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let s = 77777;
    for (let i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i] = (s / 4294967296) * 2 - 1;
    }
  }
  return noiseBuf;
}

// ---------------------------------------------------------------------------
// Determinismo: mulberry32 + hash FNV-1a (mismo espíritu que la escena 3D)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** MIDI → Hz. */
function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---------------------------------------------------------------------------
// Instrumentos sintetizados (tiempos ABSOLUTOS del AudioContext)
// ---------------------------------------------------------------------------

type NotaOpts = {
  type: OscillatorType;
  f: number;
  /** Frecuencia final (glissando exponencial); si falta, se mantiene f. */
  f1?: number;
  at: number;
  dur: number;
  gain: number;
  attack?: number;
  detune?: number;
};

/** Oscilador con envolvente exponencial ataque→caída. */
function nota(ac: AudioContext, out: AudioNode, o: NotaOpts) {
  const t0 = o.at;
  const osc = ac.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(Math.max(1, o.f), t0);
  if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  const g = ac.createGain();
  const atk = o.attack ?? 0.01;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

/** Campana cristalina: parciales inarmónicos que se apagan a ritmos distintos. */
function campana(ac: AudioContext, out: AudioNode, f: number, at: number, gain: number, dur = 2.4) {
  const parciales: Array<[number, number]> = [
    [1, 1],
    [2.76, 0.35],
    [5.4, 0.12],
  ];
  for (const [ratio, peso] of parciales) {
    nota(ac, out, { type: "sine", f: f * ratio, at, dur: dur / (1 + ratio * 0.4), gain: gain * peso, attack: 0.004 });
  }
}

/** Marimba acuática: fundamental corto + "clac" del 4º armónico. */
function marimba(ac: AudioContext, out: AudioNode, f: number, at: number, gain: number) {
  nota(ac, out, { type: "sine", f, at, dur: 0.4, gain, attack: 0.003 });
  nota(ac, out, { type: "sine", f: f * 4, at, dur: 0.09, gain: gain * 0.3, attack: 0.003 });
}

/** Golpe grave suave (percusión / latido): seno con caída de tono. */
function pulso(ac: AudioContext, out: AudioNode, at: number, gain: number, f0 = 120, f1 = 45) {
  nota(ac, out, { type: "sine", f: f0, f1, at, dur: 0.25, gain, attack: 0.005 });
}

/** Pad etéreo: dos sierras desafinadas bajo un lowpass, envolvente lenta. */
function pad(ac: AudioContext, out: AudioNode, f: number, at: number, dur: number, gain: number, cutoff = 800) {
  const attack = Math.min(1.2, dur * 0.3);
  const release = Math.min(1.5, dur * 0.3);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  lp.Q.value = 0.4;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + attack);
  g.gain.setValueAtTime(gain, Math.max(at + attack, at + dur - release));
  g.gain.linearRampToValueAtTime(0.0001, at + dur);
  lp.connect(g).connect(out);
  for (const d of [-6, 6]) {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    osc.detune.value = d;
    osc.connect(lp);
    osc.start(at);
    osc.stop(at + dur + 0.1);
  }
}

/** Ruido filtrado (ticks de percusión, olas, viento). */
function ruido(
  ac: AudioContext,
  out: AudioNode,
  o: { at: number; dur: number; gain: number; f0: number; f1?: number; attack?: number },
) {
  const src = ac.createBufferSource();
  src.buffer = ensureNoise(ac);
  src.loop = true; // las olas duran más que el buffer
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.max(30, o.f0), o.at);
  if (o.f1 !== undefined) lp.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), o.at + o.dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), o.at + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  src.connect(lp).connect(g).connect(out);
  src.start(o.at);
  src.stop(o.at + o.dur + 0.05);
}

// ---------------------------------------------------------------------------
// Temas por bioma (art bible §8): loops de 8 compases 4/4 con variación
// determinista por compás. Volúmenes bajos; nada estridente jamás.
// ---------------------------------------------------------------------------

type Tema = {
  bpm: number;
  /** Longitud del loop en compases. */
  bars: number;
  /** Cantidad de señal enviada al delay compartido (0..1). */
  space: number;
  bar(ac: AudioContext, out: AudioNode, t0: number, compas: number, rand: () => number, beat: number): void;
};

const TEMAS: Record<string, Tema> = {
  /** Bosque del Descubrimiento: arpa/flauta pentatónica cálida + pájaros. */
  bosque: {
    bpm: 84,
    bars: 8,
    space: 0.3,
    bar(ac, out, t0, compas, rand, beat) {
      const penta = [60, 62, 64, 67, 69, 72, 74, 76]; // Do pentatónica mayor
      const raices = [48, 45, 41, 43]; // C–A–F–G: luz de tarde
      nota(ac, out, { type: "sine", f: hz(raices[compas % 4]), at: t0, dur: beat * 3.6, gain: 0.06, attack: 0.4 });
      // Arpa: corcheas con paseo aleatorio determinista por la escala
      let ix = 2 + Math.floor(rand() * 4);
      for (let c = 0; c < 8; c++) {
        if (rand() < 0.62) {
          nota(ac, out, { type: "triangle", f: hz(penta[ix]), at: t0 + c * beat * 0.5, dur: 0.55, gain: 0.075, attack: 0.005 });
        }
        ix = Math.min(penta.length - 1, Math.max(0, ix + (rand() < 0.5 ? -1 : 1)));
      }
      // Flauta: motivo breve una octava arriba, en compases alternos
      if (compas % 2 === 1) {
        const m = [penta[4 + Math.floor(rand() * 3)], penta[3 + Math.floor(rand() * 3)]];
        m.forEach((n, i) =>
          nota(ac, out, { type: "sine", f: hz(n + 12), at: t0 + beat * (1 + i * 1.5), dur: beat * 1.2, gain: 0.045, attack: 0.09 }),
        );
      }
      // Pájaros sutiles, muy al fondo
      if (rand() < 0.35) {
        const tp = t0 + rand() * beat * 3;
        nota(ac, out, { type: "sine", f: 2900, f1: 3600, at: tp, dur: 0.09, gain: 0.016, attack: 0.01 });
        nota(ac, out, { type: "sine", f: 3300, f1: 2700, at: tp + 0.13, dur: 0.08, gain: 0.013, attack: 0.01 });
      }
    },
  },

  /** Ciudadela circuito: secuencia synth fría en La menor con mucho eco. */
  algoritmos: {
    bpm: 104,
    bars: 8,
    space: 0.55,
    bar(ac, out, t0, compas, rand, beat) {
      const esc = [57, 60, 62, 64, 67, 69, 71, 72]; // La menor: frialdad de datos
      nota(ac, out, { type: "triangle", f: hz(33), at: t0, dur: beat * 3.8, gain: 0.07, attack: 0.3 });
      for (let c = 0; c < 8; c++) {
        if (rand() < 0.55) {
          const n = esc[Math.floor(rand() * esc.length)];
          nota(ac, out, { type: "square", f: hz(n + 12), at: t0 + c * beat * 0.5, dur: 0.14, gain: 0.03, attack: 0.004 });
        }
      }
      // Baliza de datos cada 4 compases
      if (compas % 4 === 0) nota(ac, out, { type: "sine", f: hz(93), at: t0, dur: 0.5, gain: 0.018, attack: 0.02 });
    },
  },

  /** Desierto de las Crónicas: frigia dorada descendente + percusión suave. */
  cronicas: {
    bpm: 76,
    bars: 8,
    space: 0.35,
    bar(ac, out, t0, compas, rand, beat) {
      const frigia = [62, 63, 65, 67, 69, 70, 72, 74]; // Re frigia, sol de atardecer
      // Drone en quinta (D–A), como estandartes al viento
      nota(ac, out, { type: "sine", f: hz(38), at: t0, dur: beat * 3.8, gain: 0.05, attack: 0.5 });
      nota(ac, out, { type: "sine", f: hz(45), at: t0, dur: beat * 3.8, gain: 0.035, attack: 0.5 });
      // Melodía con tendencia descendente (carácter frigio)
      let ix = Math.min(7, 5 + Math.floor(rand() * 3));
      for (let c = 0; c < 8; c++) {
        if (rand() < 0.5) {
          nota(ac, out, { type: "triangle", f: hz(frigia[ix]), at: t0 + c * beat * 0.5, dur: 0.5, gain: 0.07, attack: 0.006 });
          ix = Math.min(7, Math.max(0, ix - (rand() < 0.65 ? 1 : -1)));
        }
      }
      // Percusión de caravana, siempre suave
      pulso(ac, out, t0, 0.09, 110, 42);
      pulso(ac, out, t0 + beat * 2.5, 0.07, 100, 40);
      for (let c = 0; c < 8; c++) {
        if (c % 2 === 1 && rand() < 0.4) ruido(ac, out, { at: t0 + c * beat * 0.5, dur: 0.06, gain: 0.014, f0: 5000, f1: 2800 });
      }
    },
  },

  /** Cavernas de cristal: campanas cristalinas espaciadas con mucha sala. */
  laboratorio: {
    bpm: 60,
    bars: 8,
    space: 0.6,
    bar(ac, out, t0, compas, rand, beat) {
      const set = [72, 74, 76, 79, 81, 83, 84, 88]; // registro cristalino (lidio)
      const nCampanas = 2 + Math.floor(rand() * 2);
      for (let i = 0; i < nCampanas; i++) {
        const corchea = Math.floor(rand() * 8);
        campana(ac, out, hz(set[Math.floor(rand() * set.length)]), t0 + corchea * beat * 0.5, 0.04);
      }
      // Aliento grave de la caverna, alternando C3 / G2
      nota(ac, out, { type: "sine", f: hz(compas % 2 ? 43 : 48), at: t0, dur: beat * 3.8, gain: 0.035, attack: 0.8 });
    },
  },

  /** Archipiélago de las Mareas: marimba acuática + olas de ruido filtrado. */
  lenguas: {
    bpm: 88,
    bars: 8,
    space: 0.4,
    bar(ac, out, t0, compas, rand, beat) {
      const penta = [53, 55, 58, 60, 62, 65, 67, 70]; // Fa "marina" con séptima
      nota(ac, out, { type: "sine", f: hz(compas % 2 ? 48 : 41), at: t0, dur: beat * 3.6, gain: 0.05, attack: 0.4 });
      let ix = 2 + Math.floor(rand() * 4);
      for (let c = 0; c < 8; c++) {
        if (rand() < 0.6) marimba(ac, out, hz(penta[ix]), t0 + c * beat * 0.5, 0.06);
        ix = Math.min(penta.length - 1, Math.max(0, ix + (rand() < 0.5 ? -1 : 1)));
      }
      // Ola cada 2 compases: espuma que rompe y se retira
      if (compas % 2 === 0) ruido(ac, out, { at: t0 + rand() * beat, dur: 2.8, gain: 0.04, f0: 700, f1: 180, attack: 1.3 });
    },
  },

  /** Plataformas astrales: pads etéreos lentísimos + destellos estelares. */
  observatorio: {
    bpm: 48,
    bars: 8,
    space: 0.5,
    bar(ac, out, t0, compas, rand, beat) {
      if (compas % 2 === 0) {
        const acordes = [
          [50, 57, 61, 66],
          [47, 54, 59, 64],
          [52, 57, 61, 68],
          [45, 52, 59, 64],
        ];
        const notas = acordes[(compas / 2) % acordes.length];
        for (const n of notas) pad(ac, out, hz(n), t0, beat * 8.4, 0.03, 750);
      }
      // Destellos: agudos lejanos que aparecen y se desvanecen
      if (rand() < 0.4) {
        nota(ac, out, { type: "sine", f: hz(85 + Math.floor(rand() * 5)), at: t0 + rand() * beat * 3, dur: 1.4, gain: 0.016, attack: 0.5 });
      }
    },
  },

  /** Fortaleza del Vacío: drone grave amenazante con pulsos. Nunca estridente. */
  "fortaleza-vacio": {
    bpm: 60,
    bars: 8,
    space: 0.45,
    bar(ac, out, t0, compas, rand, beat) {
      // Drone de obsidiana: sierras graves desafinadas bajo un lowpass cerrado
      pad(ac, out, hz(33), t0, beat * 4.6, 0.055, 190);
      // Latido del núcleo violeta
      pulso(ac, out, t0, 0.11, 90, 38);
      pulso(ac, out, t0 + beat * 2, 0.09, 85, 36);
      // Susurro disonante lejano (segunda menor), casi inaudible
      if (rand() < 0.3) {
        const ts = t0 + rand() * beat * 2;
        nota(ac, out, { type: "sine", f: hz(69), at: ts, dur: 2.2, gain: 0.013, attack: 0.9 });
        nota(ac, out, { type: "sine", f: hz(70), at: ts + 0.4, dur: 2.2, gain: 0.011, attack: 0.9 });
      }
    },
  },
};

/** Capa rítmica de combate sobre el tema del mundo (suave, sin estridencias). */
function capaBatalla(
  ac: AudioContext,
  out: AudioNode,
  t0: number,
  rand: () => number,
  beat: number,
  variant: MusicBattleVariant,
) {
  pulso(ac, out, t0, 0.1, 130, 48);
  pulso(ac, out, t0 + beat * 2, 0.1, 130, 48);
  for (let c = 0; c < 8; c++) {
    if (c % 2 === 1 && rand() < 0.8) ruido(ac, out, { at: t0 + c * beat * 0.5, dur: 0.05, gain: 0.018, f0: 4500, f1: 2500 });
  }
  if (variant === "boss") {
    // El jefe pesa más: pulso extra a contratiempo + sub-drone
    pulso(ac, out, t0 + beat * 3, 0.08, 110, 42);
    nota(ac, out, { type: "triangle", f: hz(33), at: t0, dur: beat * 3.8, gain: 0.045, attack: 0.2 });
  }
}

// ---------------------------------------------------------------------------
// Sesiones: una por tema activo, con su propio gain (crossfade) y scheduler
// ---------------------------------------------------------------------------

type Sesion = {
  key: string;
  parar: (fadeS: number) => void;
};

let sesion: Sesion | null = null;
let lastWorldId: string | null = null;

type Deseo = { tipo: "mundo"; worldId: string } | { tipo: "batalla"; variant: MusicBattleVariant };
let deseo: Deseo | null = null;

function claveDeseada(): string | null {
  if (!deseo) return null;
  if (deseo.tipo === "mundo") return `mundo:${deseo.worldId}`;
  return `batalla:${lastWorldId ?? "bosque"}:${deseo.variant}`;
}

function crearSesion(ac: AudioContext, key: string): Sesion {
  const partes = key.split(":");
  const esBatalla = partes[0] === "batalla";
  const worldId = partes[1] ?? "bosque";
  const variant: MusicBattleVariant = partes[2] === "boss" ? "boss" : "duelo";
  const tema = TEMAS[worldId] ?? TEMAS.bosque;
  const seed = hashStr(`nexus|${worldId}`);

  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.linearRampToValueAtTime(1, ac.currentTime + FADE_S);
  g.connect(master!);
  const send = ac.createGain();
  send.gain.value = tema.space;
  g.connect(send);
  send.connect(delayIn!);

  const beat = 60 / tema.bpm;
  const barDur = beat * 4;
  let proximo = ac.currentTime + 0.06;
  let compas = 0;

  // Scheduler con lookahead: programa compases ~0.9 s por delante.
  const tick = () => {
    try {
      while (proximo < ac.currentTime + 0.9) {
        const idx = compas % tema.bars;
        const rand = mulberry32((seed ^ Math.imul(idx + 1, 2654435761)) >>> 0);
        tema.bar(ac, g, proximo, idx, rand, beat);
        if (esBatalla) {
          const randB = mulberry32((seed ^ 0x9e3779b9 ^ Math.imul(idx + 1, 40503)) >>> 0);
          capaBatalla(ac, g, proximo, randB, beat, variant);
        }
        proximo += barDur;
        compas++;
      }
    } catch {
      // La música jamás debe romper el juego.
    }
  };
  tick();
  const timer = window.setInterval(tick, 250);

  const parar = (fadeS: number) => {
    window.clearInterval(timer);
    try {
      const t = ac.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.05, fadeS));
    } catch {
      /* noop */
    }
    // Desconecta cuando el fundido (y las colas ya programadas) hayan muerto.
    window.setTimeout(() => {
      try {
        g.disconnect();
        send.disconnect();
      } catch {
        /* noop */
      }
    }, (fadeS + 4) * 1000);
  };

  return { key, parar };
}

/** Arranca (o cambia con crossfade) la sesión que pide el estado deseado. */
function arrancar() {
  if (!encendido) return;
  const key = claveDeseada();
  if (!key) return;
  // Sin contexto todavía: no lo creamos fuera de un gesto; lo dejamos armado.
  if (!ctx) {
    armarGesto();
    return;
  }
  const ac = ensureCtx();
  if (!ac || !master || !delayIn) return;
  if (sesion?.key === key) return;
  sesion?.parar(FADE_S);
  try {
    sesion = crearSesion(ac, key);
  } catch {
    sesion = null;
  }
  // Si el contexto sigue suspendido (autoplay policy), reintenta al próximo gesto.
  if (ac.state !== "running") armarGesto();
}

// Primer gesto del usuario: crea/reanuda el contexto y arranca lo pendiente.
let gestoArmado = false;
function armarGesto() {
  if (gestoArmado || typeof window === "undefined") return;
  gestoArmado = true;
  const disparo = () => {
    window.removeEventListener("pointerdown", disparo);
    window.removeEventListener("keydown", disparo);
    gestoArmado = false;
    if (!encendido || !deseo) return;
    if (ensureCtx()) arrancar();
  };
  window.addEventListener("pointerdown", disparo);
  window.addEventListener("keydown", disparo);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** Tema ambiental del mundo (crossfade 1-2 s si había otro sonando). */
function enterWorld(worldId: string) {
  lastWorldId = worldId;
  deseo = { tipo: "mundo", worldId };
  arrancar();
}

/**
 * Tema del mundo + capa rítmica de combate. `worldId` opcional para retos a
 * los que se llega por deep-link (sin haber pisado el mundo en esta sesión).
 */
function enterBattle(variant: MusicBattleVariant = "duelo", worldId?: string) {
  if (worldId) lastWorldId = worldId;
  deseo = { tipo: "batalla", variant };
  arrancar();
}

/** Fundido de salida limpio (cleanup de efectos React). */
function stop(fadeMs = 800) {
  deseo = null;
  if (sesion) {
    sesion.parar(fadeMs / 1000);
    sesion = null;
  }
}

function setOn(v: boolean) {
  encendido = v;
  try {
    window.localStorage.setItem(STORAGE_KEY, v ? "on" : "off");
  } catch {
    // sin persistencia: la sesión sigue funcionando
  }
  if (v) {
    // Llega desde el click del toggle: gesto válido para crear el contexto.
    ensureCtx();
    arrancar();
  } else if (sesion) {
    sesion.parar(0.5);
    sesion = null;
  }
}

function isOn(): boolean {
  return encendido;
}

export const music = { enterWorld, enterBattle, stop, setOn, isOn };
