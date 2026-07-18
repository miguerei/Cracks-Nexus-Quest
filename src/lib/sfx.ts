// sfx.ts — audio procedural del combate (WebAudio, CERO assets).
//
// Todos los sonidos se sintetizan al vuelo con osciladores, envolventes y
// ruido filtrado. El AudioContext se crea LAZY en el primer gesto del usuario
// (los play() siempre llegan desde handlers de click), jamás al cargar el
// módulo. Preferencia ON/OFF persistida en localStorage (por defecto ON).
//
// API:
//   sfx.play("cast" | "impact" | "correct" | "wrong" | "victory" | "defeat" | "click")
//   sfx.battle(kind)   → secuencia ligada a un BattleEvent del escenario 3D
//   sfx.setOn(bool) / sfx.isOn()

export type SfxName = "cast" | "impact" | "correct" | "wrong" | "victory" | "defeat" | "click";

/** Mismo union que BattleEventKind (battle3d/types) sin importar three al grafo. */
export type SfxBattleKind = "idle" | "cast" | "miss" | "victory" | "defeat";

const STORAGE_KEY = "nexus:sfx-on";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function leerPreferencia(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

let encendido = leerPreferencia();

/** Crea (una vez) y reanuda el AudioContext. null si no hay soporte. */
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
      master.gain.value = 0.32; // volumen general contenido: es feedback, no música
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

/** Buffer de ruido blanco compartido (se genera una única vez). */
function ensureNoise(ac: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    const n = Math.floor(ac.sampleRate * 0.5);
    noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    // Ruido determinista (LCG): mismo carácter en cada sesión.
    let s = 22222;
    for (let i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i] = (s / 4294967296) * 2 - 1;
    }
  }
  return noiseBuf;
}

type ToneOpts = {
  type: OscillatorType;
  /** Frecuencia inicial (Hz). */
  f0: number;
  /** Frecuencia final (Hz); si se omite, se mantiene f0. */
  f1?: number;
  /** Retardo desde ahora (s). */
  at?: number;
  /** Duración (s). */
  dur: number;
  /** Ganancia pico (0..1 relativa al master). */
  gain: number;
  /** Ataque (s). */
  attack?: number;
};

/** Oscilador con envolvente exponencial ataque→caída. */
function tone(ac: AudioContext, o: ToneOpts) {
  if (!master) return;
  const t0 = ac.currentTime + (o.at ?? 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(Math.max(1, o.f0), t0);
  if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
  const atk = o.attack ?? 0.008;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

type NoiseOpts = {
  at?: number;
  dur: number;
  gain: number;
  /** Frecuencia inicial del paso-bajo (Hz). */
  lp0: number;
  /** Frecuencia final del paso-bajo (Hz). */
  lp1: number;
};

/** Ráfaga de ruido blanco a través de un paso-bajo con barrido. */
function noise(ac: AudioContext, o: NoiseOpts) {
  if (!master) return;
  const t0 = ac.currentTime + (o.at ?? 0);
  const src = ac.createBufferSource();
  src.buffer = ensureNoise(ac);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(o.lp0, t0);
  lp.frequency.exponentialRampToValueAtTime(Math.max(20, o.lp1), t0 + o.dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(lp).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + o.dur + 0.02);
}

// ---------------------------------------------------------------------------
// Diseño de cada sonido (cortos, nunca punitivos ni estridentes)
// ---------------------------------------------------------------------------
const SOUNDS: Record<SfxName, (ac: AudioContext) => void> = {
  /** Blip mínimo de interfaz. */
  click(ac) {
    tone(ac, { type: "triangle", f0: 660, f1: 880, dur: 0.06, gain: 0.18 });
  },

  /** Cast: barrido ascendente brillante (carga del hechizo, §7). */
  cast(ac) {
    tone(ac, { type: "sawtooth", f0: 210, f1: 940, dur: 0.34, gain: 0.14, attack: 0.03 });
    tone(ac, { type: "sine", f0: 480, f1: 1900, dur: 0.32, gain: 0.2, attack: 0.02 });
    // Chisporroteo del arco eléctrico
    noise(ac, { dur: 0.28, gain: 0.06, lp0: 1400, lp1: 5200 });
  },

  /** Impacto en el núcleo: golpe grave + ruido que se cierra. */
  impact(ac) {
    tone(ac, { type: "sine", f0: 160, f1: 52, dur: 0.24, gain: 0.42 });
    noise(ac, { dur: 0.3, gain: 0.3, lp0: 2600, lp1: 180 });
  },

  /** Acierto: arpegio mayor corto (Do–Mi–Sol). */
  correct(ac) {
    const notas = [523.25, 659.25, 783.99];
    notas.forEach((f, i) => tone(ac, { type: "triangle", f0: f, at: i * 0.07, dur: 0.16, gain: 0.16 }));
  },

  /** Fallo: tono grave SUAVE, sin dramatismo (el Vacío murmura, no grita). */
  wrong(ac) {
    tone(ac, { type: "sine", f0: 220, f1: 158, dur: 0.34, gain: 0.16, attack: 0.03 });
    tone(ac, { type: "sine", f0: 110, f1: 88, dur: 0.4, gain: 0.1, attack: 0.04 });
  },

  /** Victoria: fanfarria de 4 notas (Do–Mi–Sol–Do'). */
  victory(ac) {
    const notas = [523.25, 659.25, 783.99, 1046.5];
    notas.forEach((f, i) =>
      tone(ac, { type: "triangle", f0: f, at: i * 0.13, dur: i === notas.length - 1 ? 0.5 : 0.22, gain: 0.2 }),
    );
    // Brillo dorado por encima de la última nota
    tone(ac, { type: "sine", f0: 2093, at: 0.39, dur: 0.4, gain: 0.06 });
  },

  /** Derrota: descenso sereno (invita a reintentar, no castiga). */
  defeat(ac) {
    const notas = [392, 329.63, 261.63, 196];
    notas.forEach((f, i) => tone(ac, { type: "sine", f0: f, at: i * 0.18, dur: 0.3, gain: 0.15, attack: 0.03 }));
  },
};

function play(name: SfxName) {
  if (!encendido) return;
  const ac = ensureCtx();
  if (!ac) return;
  try {
    SOUNDS[name](ac);
  } catch {
    // El audio jamás debe romper el juego.
  }
}

/** Retardo de la secuencia de combate (sincronizado con el vuelo del proyectil). */
const IMPACT_MS = 700;

/**
 * Secuencia sonora de un evento del escenario 3D (battle3d):
 * - cast    → barrido + (impacto + arpegio) al llegar el proyectil al núcleo.
 * - miss    → tono grave suave del pulso del Vacío.
 * - victory → cast + impacto + fanfarria.
 * - defeat  → descenso sereno.
 */
function battle(kind: SfxBattleKind) {
  if (typeof window === "undefined") return;
  switch (kind) {
    case "cast":
      play("cast");
      window.setTimeout(() => {
        play("impact");
        play("correct");
      }, IMPACT_MS);
      break;
    case "miss":
      play("wrong");
      break;
    case "victory":
      play("cast");
      window.setTimeout(() => play("impact"), IMPACT_MS);
      window.setTimeout(() => play("victory"), IMPACT_MS + 380);
      break;
    case "defeat":
      play("defeat");
      break;
    default:
      break;
  }
}

function setOn(v: boolean) {
  encendido = v;
  try {
    window.localStorage.setItem(STORAGE_KEY, v ? "on" : "off");
  } catch {
    // sin persistencia: la sesión sigue funcionando
  }
}

function isOn(): boolean {
  return encendido;
}

export const sfx = { play, battle, setOn, isOn };
