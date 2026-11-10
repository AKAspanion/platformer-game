"""
Chiptune-style sound effects and boss music, synthesized from scratch
(plain Python; ffmpeg encodes the music to MP3).

    python3 scripts/generate-audio.py

Writes
  app/assets/audio/sfx/<name>.wav     enemy, boss, power-up and gate sounds
  app/assets/audio/boss-<kind>.mp3    one looping battle theme per boss

Output is deterministic (seeded). Run with --sfx or --music to do only one.
"""

import array
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile
import wave

RATE = 22050
ROOT = os.path.join(os.path.dirname(__file__), "..", "app", "assets", "audio")
SFX = os.path.join(ROOT, "sfx")
TAU = math.tau


# ------------------------------------------------------------------ synthesis


def osc(kind, phase, duty=0.5):
    p = phase % 1.0
    if kind == "square":
        return 1.0 if p < duty else -1.0
    if kind == "triangle":
        return 4 * p - 1 if p < 0.5 else 3 - 4 * p
    if kind == "saw":
        return 2 * p - 1
    return math.sin(TAU * p)


class Noise:
    def __init__(self, seed=1):
        self.rng = random.Random(seed)
        self.value = 0.0
        self.count = 0

    def sample(self, hold=1):
        """`hold` > 1 gives crunchier, lower 'NES' noise."""
        if self.count <= 0:
            self.value = self.rng.uniform(-1, 1)
            self.count = hold
        self.count -= 1
        return self.value


def env(t, length, attack=0.005, release=None, curve=1.0):
    """Attack then exponential-ish decay to zero at `length`."""
    if t < attack:
        return t / attack
    release = release or (length - attack)
    x = max(0.0, 1 - (t - attack) / release)
    return x**curve


def tone(length, f0, f1=None, kind="square", vol=0.5, duty=0.5, vibrato=0.0, vib_rate=8.0, curve=1.5, attack=0.004):
    """A pitched blip sliding from f0 to f1 (exponential glide)."""
    f1 = f1 or f0
    n = int(length * RATE)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / RATE
        k = i / max(1, n - 1)
        f = f0 * (f1 / f0) ** k
        if vibrato:
            f *= 1 + vibrato * math.sin(TAU * vib_rate * t)
        phase += f / RATE
        out[i] = osc(kind, phase, duty) * env(t, length, attack, curve=curve) * vol
    return out


def noise(length, vol=0.5, hold=1, curve=1.5, seed=3, attack=0.002, lowpass=1.0, sweep=None):
    """Noise burst. `lowpass` 0..1 (1 = none); `sweep` (a, b) moves it over time."""
    n = int(length * RATE)
    src = Noise(seed)
    out = [0.0] * n
    y = 0.0
    for i in range(n):
        t = i / RATE
        a = lowpass if not sweep else sweep[0] + (sweep[1] - sweep[0]) * (i / max(1, n - 1))
        y += a * (src.sample(hold) - y)
        out[i] = y * env(t, length, attack, curve=curve) * vol
    return out


def mix(*parts, offsets=None):
    offsets = offsets or [0] * len(parts)
    n = max(int(o * RATE) + len(p) for p, o in zip(parts, offsets))
    out = [0.0] * n
    for p, o in zip(parts, offsets):
        start = int(o * RATE)
        for i, v in enumerate(p):
            out[start + i] += v
    return out


def seq(*parts, gap=0.0):
    out = []
    for p in parts:
        out += p + [0.0] * int(gap * RATE)
    return out


def normalize(samples, peak=0.85):
    m = max(1e-9, max(abs(s) for s in samples))
    return [s * peak / m for s in samples]


def write_wav(path, samples):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = array.array("h", (int(max(-1, min(1, s)) * 32767) for s in samples))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())


# ------------------------------------------------------------------- sfx list


def sfx_list():
    s = {}
    # walking enemies: an attack cry (on the wind-up) and a death sound
    s["pig-attack"] = mix(tone(0.22, 140, 90, "square", 0.5, 0.3, vibrato=0.08, vib_rate=30), noise(0.18, 0.25, 4, lowpass=0.3))
    s["pig-die"] = seq(tone(0.12, 500, 950, "saw", 0.45, vibrato=0.05, vib_rate=25), tone(0.2, 950, 300, "saw", 0.4))
    s["slime-attack"] = tone(0.22, 320, 110, "sine", 0.7, vibrato=0.25, vib_rate=18, curve=1.2)
    s["slime-die"] = mix(noise(0.3, 0.6, 2, lowpass=0.15, curve=2), tone(0.25, 180, 60, "sine", 0.6))
    s["chameleon-attack"] = noise(0.32, 0.5, 1, attack=0.08, curve=1.2, lowpass=0.7)
    s["chameleon-die"] = tone(0.25, 1100, 280, "triangle", 0.6)
    s["beetle-attack"] = seq(tone(0.03, 1500, 900, "square", 0.4), tone(0.03, 1200, 700, "square", 0.4), gap=0.05)
    s["beetle-armor"] = mix(
        tone(0.35, 523, kind="sine", vol=0.4, curve=3),
        tone(0.3, 1213, kind="sine", vol=0.3, curve=3),
        tone(0.25, 1889, kind="sine", vol=0.25, curve=3),
        noise(0.04, 0.4, 1),
    )
    s["beetle-die"] = mix(noise(0.22, 0.6, 3, curve=2, lowpass=0.5), tone(0.2, 120, 50, "square", 0.4))
    s["bat-attack"] = tone(0.28, 1900, 2400, "square", 0.3, 0.25, vibrato=0.06, vib_rate=40)
    s["bat-die"] = tone(0.22, 2600, 900, "square", 0.3, 0.25)
    s["spitter-spit"] = mix(tone(0.09, 650, 180, "sine", 0.8), noise(0.03, 0.4, 1))
    s["spitter-die"] = mix(noise(0.25, 0.45, 2, curve=2, lowpass=0.4), tone(0.12, 400, 120, "sine", 0.5))

    # boss roars: one per boss, played on each wind-up
    s["roar-kingPig"] = mix(tone(0.55, 110, 70, "saw", 0.5, vibrato=0.12, vib_rate=22), noise(0.5, 0.35, 6, lowpass=0.25))
    s["roar-frostSlime"] = tone(0.5, 260, 90, "sine", 0.8, vibrato=0.3, vib_rate=12, curve=1.1)
    s["roar-sandLizard"] = mix(noise(0.55, 0.55, 1, attack=0.05, lowpass=0.6), tone(0.5, 180, 120, "saw", 0.3, vibrato=0.1, vib_rate=15))
    s["roar-batLord"] = mix(tone(0.5, 1400, 2600, "square", 0.3, 0.2, vibrato=0.08, vib_rate=35), tone(0.5, 700, 1300, "saw", 0.2))
    s["roar-mechBeetle"] = seq(*[tone(0.11, f, kind="square", vol=0.4, curve=0.3) for f in (880, 660, 880, 660)], gap=0.02)

    # boss moves
    s["boss-charge"] = noise(0.45, 0.6, 1, attack=0.05, curve=1.2, sweep=(0.08, 0.6))
    s["boss-jump"] = tone(0.25, 180, 520, "square", 0.4, 0.3)
    s["boss-slam"] = mix(tone(0.4, 90, 40, "sine", 1.0, curve=2), noise(0.25, 0.6, 4, lowpass=0.3, curve=2))
    s["boss-hit"] = mix(tone(0.12, 400, 120, "square", 0.5), noise(0.08, 0.5, 1))
    s["icicle-fall"] = tone(0.45, 2200, 900, "sine", 0.35, curve=0.6)
    s["icicle-shatter"] = mix(noise(0.25, 0.5, 1, curve=2.5), *[tone(0.3, f, kind="sine", vol=0.15, curve=3) for f in (2100, 2650, 3300)])
    s["vanish"] = seq(*[tone(0.06, f, kind="sine", vol=0.4, vibrato=0.03, vib_rate=20) for f in (1600, 1300, 1000, 800, 600)])
    s["tongue"] = tone(0.14, 300, 1400, "sine", 0.7, curve=0.8)
    s["rings"] = tone(0.5, 140, 90, "sine", 0.9, vibrato=0.4, vib_rate=10, curve=1)
    s["summon"] = seq(*[tone(0.08, f, kind="triangle", vol=0.5) for f in (523, 659, 784, 1047)])
    s["missile-launch"] = mix(noise(0.35, 0.45, 1, attack=0.02, sweep=(0.1, 0.5)), tone(0.3, 300, 700, "square", 0.2, 0.25))
    s["explosion"] = mix(noise(0.7, 0.8, 5, curve=1.8, sweep=(0.6, 0.1)), tone(0.5, 80, 35, "sine", 0.8, curve=2))
    s["laser-charge"] = tone(0.85, 250, 1600, "sine", 0.45, vibrato=0.04, vib_rate=30, curve=0.2, attack=0.1)
    s["laser-fire"] = mix(tone(0.5, 110, kind="square", vol=0.4, duty=0.3, curve=0.8), noise(0.5, 0.3, 2, curve=0.8, lowpass=0.5))
    s["gate"] = mix(tone(0.45, 70, 45, "sine", 0.9, curve=2), noise(0.3, 0.5, 6, curve=2, lowpass=0.35), tone(0.3, 330, kind="square", vol=0.12, curve=3))
    # fanfare when a boss falls
    fan = [(523, 0.12), (659, 0.12), (784, 0.12), (1047, 0.3), (0, 0.06), (988, 0.12), (1047, 0.7)]
    s["boss-defeat"] = seq(*[tone(d, f, kind="square", vol=0.35, duty=0.25, curve=0.7) if f else [0.0] * int(d * RATE) for f, d in fan])

    # power-ups and shield
    s["powerup"] = seq(*[tone(0.07, f, kind="square", vol=0.3, duty=0.25) for f in (523, 659, 784, 1047, 1319)])
    s["heart"] = seq(tone(0.12, 659, kind="triangle", vol=0.6), tone(0.25, 988, kind="triangle", vol=0.6))
    s["shield-block"] = mix(tone(0.4, 1568, kind="sine", vol=0.5, curve=3), tone(0.35, 2093, kind="sine", vol=0.3, curve=3))
    return s


# ---------------------------------------------------------------------- music

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# per boss: key, tempo, scale, lead wave/duty, progression (scale degrees), extra
THEMES = {
    "kingPig": dict(key="C", bpm=150, scale=[0, 2, 3, 5, 7, 8, 10], lead=("square", 0.5), prog=[0, 5, 3, 6], seed=1),
    "frostSlime": dict(key="D", bpm=138, scale=[0, 2, 3, 5, 7, 8, 10], lead=("triangle", 0.5), prog=[0, 3, 5, 4], seed=2, bell=True),
    "sandLizard": dict(key="E", bpm=158, scale=[0, 1, 4, 5, 7, 8, 10], lead=("saw", 0.5), prog=[0, 1, 0, 6], seed=3),
    "batLord": dict(key="A", bpm=144, scale=[0, 2, 3, 5, 7, 8, 11], lead=("square", 0.25), prog=[0, 5, 1, 4], seed=4, organ=True),
    "mechBeetle": dict(key="F#", bpm=172, scale=[0, 2, 3, 5, 7, 8, 10], lead=("saw", 0.5), prog=[0, 6, 5, 4], seed=5, heavy=True),
}


def render_theme(kind, bars=16):
    cfg = THEMES[kind]
    rng = random.Random(cfg["seed"])
    beat = 60 / cfg["bpm"]
    total = bars * 4 * beat
    n = int(total * RATE)
    out = [0.0] * n
    root = 48 + NOTE[cfg["key"]]  # C3-ish
    scale = cfg["scale"]

    def degree(d, octave=0):
        return root + scale[d % 7] + 12 * (d // 7 + octave)

    def add(samples, at, gain=1.0):
        start = int(at * RATE)
        for i, v in enumerate(samples):
            j = start + i
            if j >= n:
                break
            out[j] += v * gain

    # a short melody motif, repeated with variation each 4 bars
    motif = []
    d = 4
    for step in range(16):
        if rng.random() < 0.7:
            d = max(0, min(9, d + rng.choice([-2, -1, 1, 1, 2, 3, -3])))
            motif.append((step, d, rng.choice([1, 1, 2, 2, 3])))

    hat = Noise(9)
    for bar in range(bars):
        chord = cfg["prog"][bar % len(cfg["prog"])]
        t0 = bar * 4 * beat
        # bass: driving eighths on the chord root (octave jumps on the off beats)
        for e in range(8):
            m = degree(chord, -1) + (12 if e % 2 and cfg.get("heavy") else 0)
            kind = "triangle" if not cfg.get("heavy") else "square"
            add(tone(beat / 2 * 0.9, midi_hz(m), kind=kind, vol=0.26, duty=0.5, curve=0.6), t0 + e * beat / 2)
        # arpeggio: sixteenths over the chord, quiet
        tones = [chord, chord + 2, chord + 4, chord + 7]
        for s16 in range(16):
            m = degree(tones[s16 % 4], 1)
            wave_kind = "square" if not cfg.get("bell") else "sine"
            add(tone(beat / 4 * 0.8, midi_hz(m), kind=wave_kind, vol=0.1, duty=0.125, curve=2), t0 + s16 * beat / 4)
        # lead: the motif from the second phrase on (the intro is drums + bass)
        if bar >= 2:
            variation = (bar // 4) % 2
            for step, md, length in motif:
                m = degree(md + chord + variation * 2, 1 + (1 if cfg.get("bell") else 0))
                lk, duty = cfg["lead"]
                add(tone(beat / 4 * length * 0.95, midi_hz(m), kind=lk, vol=0.24, duty=duty, vibrato=0.006, vib_rate=6, curve=0.8), t0 + step * beat / 4)
                if cfg.get("organ"):
                    add(tone(beat / 4 * length * 0.95, midi_hz(m - 12), kind="square", vol=0.07, duty=0.5, curve=0.8), t0 + step * beat / 4)
        # drums
        for b in range(4):
            tb = t0 + b * beat
            if b in (0, 2) or (cfg.get("heavy") and b == 3):
                add(tone(0.16, 150, 45, "sine", 0.5, curve=2), tb)  # kick
            if b in (1, 3):
                add(noise(0.14, 0.35, 1, curve=2, seed=bar * 4 + b, lowpass=0.6), tb)  # snare
            for h in range(2):
                th = tb + h * beat / 2
                start = int(th * RATE)
                for i in range(int(0.03 * RATE)):
                    if start + i < n:
                        out[start + i] += hat.sample(1) * 0.08 * (1 - i / (0.03 * RATE))
        if cfg.get("heavy") and bar % 2 == 1:
            add(tone(0.1, 150, 45, "sine", 0.4, curve=2), t0 + 3.5 * beat)
    return normalize(out, 0.8)


def encode_mp3(samples, path):
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "track.wav")
        write_wav(wav, samples)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-b:a", "80k", path],
            check=True,
        )


def main():
    only = set(a.lstrip("-") for a in sys.argv[1:])
    if not only or "sfx" in only:
        for name, samples in sfx_list().items():
            write_wav(os.path.join(SFX, f"{name}.wav"), normalize(samples, 0.8))
        print(f"sfx: {len(sfx_list())} sounds -> app/assets/audio/sfx/")
    if not only or "music" in only:
        if not shutil.which("ffmpeg"):
            sys.exit("ffmpeg is needed to encode the boss music")
        for kind in THEMES:
            encode_mp3(render_theme(kind), os.path.join(ROOT, f"boss-{kind}.mp3"))
            print(f"music: boss-{kind}.mp3")


if __name__ == "__main__":
    main()
