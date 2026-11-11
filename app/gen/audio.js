/**
 * Generated chiptune music and sound effects for created worlds.
 *
 * Pure JS sample synthesis (square / pulse / triangle / saw / noise voices),
 * so it runs the same in the browser and in node tests. Music is composed
 * from the spec's mood, tempo and lead voice with a seeded RNG: the same world
 * sounds the same on every device. Tracks are exact loops (note tails wrap
 * round to the start) and are encoded as 16-bit mono WAV.
 */

export const RATE = 22050;

const rngFrom = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// ------------------------------------------------------------------ voices

const osc = (wave, phase) => {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case "square":
      return p < 0.5 ? 1 : -1;
    case "pulse":
      return p < 0.25 ? 1 : -1;
    case "triangle":
      return 1 - 4 * Math.abs(p - 0.5);
    case "saw":
      return 2 * p - 1;
    case "sine":
      return Math.sin(p * Math.PI * 2);
    default:
      return 0;
  }
};

/**
 * Add one note to `out` (Float32Array) at `start` (samples). Tails past the
 * end wrap to the start when `loop` is set, so the track loops cleanly.
 */
function note(
  out,
  { start, length, hz, wave, volume, attack = 0.005, release = 0.05, slide = 0, vibrato = 0 },
  loop,
) {
  const total = Math.floor(length + release * RATE);
  const a = Math.max(1, attack * RATE);
  const r = Math.max(1, release * RATE);
  let phase = 0;
  let noiseValue = 0;
  let seed = (start * 9301 + 49297) >>> 0;
  for (let i = 0; i < total; i++) {
    const t = i / RATE;
    let env = i < a ? i / a : 1;
    if (i > length) env *= Math.max(0, 1 - (i - length) / r);
    else env *= 1 - (i / length) * 0.25; // gentle decay while held
    const f = hz * (1 + slide * (i / total)) * (1 + vibrato * Math.sin(t * 2 * Math.PI * 6));
    phase += f / RATE;
    let s;
    if (wave === "noise") {
      // sample-and-hold noise, pitched by hz
      if (phase >= 1) {
        phase -= Math.floor(phase);
        seed = (seed * 1664525 + 1013904223) >>> 0;
        noiseValue = seed / 2147483648 - 1;
      }
      s = noiseValue;
    } else s = osc(wave, phase);
    let at = start + i;
    if (at >= out.length) {
      if (!loop) break;
      at %= out.length;
    }
    out[at] += s * env * volume;
  }
}

const finish = (out, gain = 0.9) => {
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const k = peak > 0 ? gain / Math.max(peak, 0.5) : 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * k * 1.1);
  return out;
};

// ------------------------------------------------------------------- music

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

// per mood: scale, chord progressions (scale degrees), drum feel, swing
const MOODS = {
  happy: {
    scale: "major",
    prog: [
      [0, 4, 5, 3],
      [0, 3, 4, 4],
      [0, 5, 3, 4],
    ],
    drums: "pop",
    root: 60,
  },
  heroic: {
    scale: "major",
    prog: [
      [0, 4, 5, 3],
      [5, 3, 0, 4],
      [0, 3, 5, 4],
    ],
    drums: "march",
    root: 58,
  },
  mysterious: {
    scale: "dorian",
    prog: [
      [0, 6, 3, 4],
      [0, 3, 6, 0],
    ],
    drums: "soft",
    root: 57,
  },
  spooky: {
    scale: "harmonic",
    prog: [
      [0, 5, 1, 4],
      [0, 3, 5, 4],
    ],
    drums: "soft",
    root: 57,
  },
  tense: {
    scale: "phrygian",
    prog: [
      [0, 1, 0, 6],
      [0, 5, 1, 0],
    ],
    drums: "drive",
    root: 55,
  },
  chill: {
    scale: "lydian",
    prog: [
      [0, 1, 3, 0],
      [0, 5, 3, 1],
    ],
    drums: "soft",
    root: 62,
  },
  epic: {
    scale: "minor",
    prog: [
      [0, 5, 2, 6],
      [0, 3, 5, 4],
      [5, 6, 0, 0],
    ],
    drums: "march",
    root: 55,
  },
};

const DRUMS = {
  pop: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  march: { kick: [0, 6, 8], snare: [4, 12, 14], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  soft: { kick: [0], snare: [8], hat: [4, 12] },
  drive: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  battle: {
    kick: [0, 3, 6, 8, 11, 14],
    snare: [4, 12],
    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  },
};

/**
 * Compose a looping track: { samples (Float32Array), bars, bpm }.
 * `boss` makes a faster, darker battle version in the same key.
 */
export function composeTrack(music, seed, { boss = false, bars = 8 } = {}) {
  const rng = rngFrom(seed);
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const mood = MOODS[music.mood] || MOODS.happy;
  const scale =
    SCALES[
      boss ? (mood.scale === "major" || mood.scale === "lydian" ? "minor" : "harmonic") : mood.scale
    ];
  const root = mood.root + Math.floor(rng() * 4) - 2;
  const bpm = Math.min(190, Math.round((music.tempo || 120) * (boss ? 1.25 : 1)));
  const step = Math.round((60 / bpm / 4) * RATE); // a 16th note
  const out = new Float32Array(step * 16 * bars);
  const prog = boss
    ? pick([
        [0, 5, 6, 4],
        [0, 1, 0, 5],
        [0, 6, 5, 4],
      ])
    : pick(mood.prog);
  const lead = boss ? (music.lead === "triangle" ? "square" : music.lead) : music.lead || "square";
  const drums = DRUMS[boss ? "battle" : mood.drums];

  const degree = (d, octave = 0) => {
    const n = scale.length;
    const idx = ((d % n) + n) % n;
    return root + scale[idx] + 12 * (octave + Math.floor(d / n));
  };
  const chordTones = (d) => [d, d + 2, d + 4];

  // a two-bar motif, repeated with variation
  const rhythms = [
    [0, 2, 4, 6, 8, 10, 12, 14],
    [0, 3, 6, 8, 10, 12],
    [0, 4, 6, 8, 12, 14],
    [0, 2, 3, 6, 8, 11, 12],
    [0, 6, 8, 10, 14],
  ];
  const makeMotif = () => {
    const r = pick(rhythms);
    let cursor = pick([0, 2, 4]);
    return r.map((at, i) => {
      cursor += pick([-2, -1, -1, 0, 1, 1, 2, 3]) * (i ? 1 : 0);
      cursor = Math.max(-2, Math.min(9, cursor));
      const next = r[i + 1] ?? 16;
      return { at, dur: Math.max(1, next - at), deg: cursor };
    });
  };
  const motifA = makeMotif();
  const motifB = makeMotif();

  for (let bar = 0; bar < bars; bar++) {
    const chord = prog[bar % prog.length];
    const barStart = bar * 16 * step;
    const tones = chordTones(chord);

    // bass: roots and fifths
    const bassPattern = boss
      ? [0, 2, 4, 6, 8, 10, 12, 14]
      : mood.drums === "soft"
        ? [0, 8]
        : [0, 6, 8, 12];
    bassPattern.forEach((at, i) => {
      const d = i % 4 === 3 ? chord + 4 : chord;
      note(
        out,
        {
          start: barStart + at * step,
          length: step * (boss ? 1.6 : 2.5),
          hz: freq(degree(d, -2)),
          wave: "triangle",
          volume: 0.42,
          release: 0.03,
        },
        true,
      );
    });

    // arpeggio / pad
    for (let s = 0; s < 16; s += boss ? 1 : 2) {
      const d = tones[(s / (boss ? 1 : 2)) % 3];
      note(
        out,
        {
          start: barStart + s * step,
          length: step * 0.8,
          hz: freq(degree(d, 0)),
          wave: boss ? "pulse" : "square",
          volume: 0.07,
          release: 0.02,
        },
        true,
      );
    }

    // lead: motif A on odd bars, B (or A shifted to the chord) on the rest
    const motif = bar % 4 === 3 ? motifB : motifA;
    const lift = bar % 4 === 2 ? 2 : 0;
    motif.forEach(({ at, dur, deg }) => {
      // land on a chord tone at the start of the bar
      const target = at === 0 ? tones[Math.abs(deg) % 3] + (deg > 4 ? 7 : 0) : deg + chord;
      note(
        out,
        {
          start: barStart + at * step,
          length: step * dur * 0.9,
          hz: freq(degree(target + lift, 1)),
          wave: lead,
          volume: lead === "saw" ? 0.13 : lead === "triangle" ? 0.26 : 0.16,
          release: 0.04,
          vibrato: dur >= 4 ? 0.006 : 0,
        },
        true,
      );
    });

    // drums
    drums.kick.forEach((at) =>
      note(
        out,
        {
          start: barStart + at * step,
          length: step * 0.9,
          hz: 120,
          slide: -0.75,
          wave: "sine",
          volume: 0.55,
          release: 0.02,
        },
        true,
      ),
    );
    drums.snare.forEach((at) =>
      note(
        out,
        {
          start: barStart + at * step,
          length: step * 0.6,
          hz: 6000,
          wave: "noise",
          volume: 0.18,
          release: 0.04,
        },
        true,
      ),
    );
    drums.hat.forEach((at) =>
      note(
        out,
        {
          start: barStart + at * step,
          length: step * 0.12,
          hz: 14000,
          wave: "noise",
          volume: 0.05,
          release: 0.01,
        },
        true,
      ),
    );
  }
  return { samples: finish(out, 0.85), bars, bpm };
}

// --------------------------------------------------------------------- sfx

const render = (seconds, voices) => {
  const out = new Float32Array(Math.ceil(seconds * RATE));
  voices.forEach((v) =>
    note(
      out,
      { ...v, start: Math.round((v.at || 0) * RATE), length: Math.round(v.dur * RATE) },
      false,
    ),
  );
  return finish(out, 0.8);
};

/**
 * Sounds for a creature: { attack, die }. Its size and body pick the pitch:
 * blobs gurgle, bugs click, flyers screech, big ones growl.
 */
export function creatureSounds(design, seed) {
  const rng = rngFrom(seed);
  const base =
    { blob: 180, round: 320, box: 220, tall: 280, spiky: 400, bug: 600 }[design.body] || 300;
  const hz = base * (design.behavior === "flyer" ? 2.2 : 1) * (0.85 + rng() * 0.3);
  const wave =
    design.behavior === "flyer" ? "pulse" : design.body === "blob" ? "triangle" : "square";
  const attack = render(0.3, [
    { at: 0, dur: 0.08, hz: hz * 0.8, slide: 0.6, wave, volume: 0.6, release: 0.02 },
    {
      at: 0.07,
      dur: 0.14,
      hz: hz * 1.3,
      slide: -0.2,
      wave,
      volume: 0.6,
      release: 0.05,
      vibrato: 0.05,
    },
    {
      at: 0,
      dur: 0.12,
      hz: 3000,
      wave: "noise",
      volume: design.body === "bug" ? 0.4 : 0.12,
      release: 0.03,
    },
  ]);
  const die = render(0.55, [
    { at: 0, dur: 0.32, hz: hz * 1.5, slide: -0.75, wave, volume: 0.6, release: 0.1 },
    { at: 0.05, dur: 0.3, hz: 2200, slide: -0.6, wave: "noise", volume: 0.35, release: 0.12 },
  ]);
  return { attack, die };
}

/** Boss sounds: { roar, hit, defeat }, in the world's key. */
export function bossSounds(design, music, seed) {
  const rng = rngFrom(seed);
  const low = 70 + rng() * 40;
  const roar = render(0.9, [
    {
      at: 0,
      dur: 0.6,
      hz: low,
      slide: -0.3,
      wave: "saw",
      volume: 0.6,
      release: 0.2,
      vibrato: 0.08,
    },
    {
      at: 0,
      dur: 0.6,
      hz: low * 1.5,
      slide: -0.35,
      wave: "square",
      volume: 0.25,
      release: 0.2,
      vibrato: 0.1,
    },
    { at: 0, dur: 0.7, hz: 900, slide: -0.5, wave: "noise", volume: 0.35, release: 0.2 },
  ]);
  const hit = render(0.25, [
    { at: 0, dur: 0.06, hz: 900, slide: -0.5, wave: "square", volume: 0.5, release: 0.04 },
    { at: 0, dur: 0.1, hz: 4000, wave: "noise", volume: 0.4, release: 0.05 },
  ]);
  const mood = MOODS[music.mood] || MOODS.happy;
  const scale = SCALES.major;
  const r = mood.root;
  const fanfare = [0, 2, 4, 7].map((d, i) => ({
    at: i * 0.12,
    dur: i === 3 ? 0.7 : 0.1,
    hz: freq(r + 12 + scale[d % 7] + (d >= 7 ? 12 : 0)),
    wave: "square",
    volume: 0.4,
    release: 0.15,
    vibrato: i === 3 ? 0.008 : 0,
  }));
  const defeat = render(1.6, [
    ...fanfare,
    ...fanfare.map((n) => ({ ...n, hz: n.hz / 2, wave: "triangle", volume: 0.5 })),
  ]);
  return { roar, hit, defeat };
}

// --------------------------------------------------------------------- wav

/** Float32 samples (-1..1) -> 16-bit mono WAV bytes. */
export function encodeWav(samples, rate = RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** A playable URL for samples (blob: in browsers that support it). */
export function wavUrl(samples) {
  const bytes = encodeWav(samples);
  if (typeof Blob !== "undefined" && typeof URL !== "undefined" && URL.createObjectURL) {
    return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  }
  return "generated.wav";
}
