// Creature voices. VOICES[id] = { gain, reverb, idle|alert|chase|attack|special: fn(shot) }
import { rnd, pick, keys, env, formant } from './synth.js';

/* ---------- building blocks ---------- */

function howl(s, t, dur, f, vol, bend = 1) {
  const n = s.noise(t, t + dur + 0.05, 'pink');
  const g = s.g(0);
  keys(g.gain, t, [[0, 0], [dur * 0.35, vol * 3], [dur * 0.7, vol * 2.4], [dur, 0]], false);
  for (const [m, q] of [[1, 9], [1.52, 12]]) {
    const b = s.f('bandpass', f * m * 0.8, q);
    keys(b.frequency, t, [[0, f * m * 0.8], [dur * 0.5, f * m * 1.1 * bend], [dur, f * m * 0.85]]);
    n.connect(b); b.connect(g);
  }
  g.connect(s.out);
  s.tone({ t, dur, f: f * 0.5, f2: f * 0.46, vol: vol * 0.18, att: dur * 0.3, fmRate: 0.8, fmDepth: f * 0.03 });
}

function growl(s, t, dur, f, vol, rough = 26, vw = 'a', dist = 6) {
  formant(s, {
    t, dur, f0: [[0, f], [dur * 0.5, f * 1.12], [dur, f * 0.85]], vow: [[0, vw]],
    amp: [[0, 0], [0.1, 1], [Math.max(0.11, dur - 0.25), 0.9], [dur, 0]],
    vib: 35, vibRate: 7, jitter: 60, breath: 0.4, q: [4, 5, 6], gains: [1, 0.7, 0.3],
    dist, am: [rough, 0.7], vol, thick: 1.015,
  });
}

function bark(s, t, f, vol) {
  formant(s, {
    t, dur: 0.24, f0: [[0, f * 1.3], [0.05, f * 1.1], [0.24, f * 0.7]], vow: [[0, 'a'], [0.24, 'o']],
    amp: [[0, 0], [0.015, 1], [0.1, 0.8], [0.24, 0]], dist: 12, vol, breath: 0.7,
    q: [5, 6, 7], thick: 1.02, jitter: 80,
  });
  s.burst({ t, dur: 0.12, f: 1400, q: 0.8, vol: vol * 0.5 });
}

function yip(s, t, f = 650, dur = 0.28, vol = 0.8) {
  formant(s, {
    t, dur, f0: [[0, f * 0.8], [dur * 0.35, f * 1.35], [dur, f]], vow: [[0, 'a'], [dur * 0.5, 'ae'], [dur, 'e']],
    amp: [[0, 0], [0.02, 1], [dur * 0.6, 0.8], [dur, 0]], vib: 40, vibRate: 14, breath: 0.2,
    q: [12, 14, 16], vol,
  });
}

function laugh(s, t, n, f, gap, vw, vol, drop = 0.93) {
  const f0 = [], amp = [[0, 0]];
  let ff = f;
  for (let i = 0; i < n; i++) {
    const a = i * gap;
    f0.push([a, ff * 1.1], [a + gap * 0.8, ff * 0.9]);
    amp.push([a + 0.03, 1 - i * 0.05], [a + gap * 0.5, 0.65], [a + gap * 0.8, 0.05]);
    ff *= drop;
  }
  const dur = n * gap + 0.05;
  amp.push([dur, 0]);
  formant(s, { t, dur, f0, vow: [[0, vw]], amp, vib: 25, vibRate: 6, breath: 0.45, jitter: 30, q: [9, 10, 12], vol, thick: 1.006 });
}

function sob(s, t, f, vol) {
  s.burst({ t, dur: 0.16, color: 'pink', f: 1400, q: 1.2, vol: vol * 0.35, att: 0.05 });
  formant(s, {
    t: t + 0.1, dur: 0.36, f0: [[0, f * 1.05], [0.1, f * 1.08], [0.2, f * 0.9], [0.36, f * 0.78]],
    vow: [[0, 'o'], [0.2, 'a'], [0.36, 'o']], amp: [[0, 0], [0.04, 1], [0.14, 0.35], [0.2, 0.9], [0.36, 0]],
    vib: 30, vibRate: 9, breath: 0.5, jitter: 40, vol, q: [8, 10, 12],
  });
}

function shriek(s, t, dur, f0, f1, fm, depth, vol) {
  const t1 = t + dur + 0.05;
  const o = s.osc('sawtooth', f0, t, t1);
  keys(o.frequency, t, [[0, f0], [dur * 0.3, f0 * 1.2], [dur, f1]]);
  const m = s.osc('sine', fm, t, t1);
  const mg = s.g(depth);
  m.connect(mg); mg.connect(o.frequency);
  const bp = s.f('bandpass', f0 * 1.3, 3);
  keys(bp.frequency, t, [[0, f0 * 1.3], [dur, f1 * 1.3]]);
  const sh = s.shaper(40);
  const g = s.g(0);
  env(g.gain, t, vol * 2.5, 0.03, dur);
  s.chain(o, bp, sh, g, s.out);
  const n = s.noise(t, t1, 'white');
  const hp = s.f('highpass', 2500);
  const ng = s.g(0.3);
  s.chain(n, hp, ng, g);
}

function creak(s, t, dur, f, vol) {
  const t1 = t + dur + 0.05;
  const o = s.osc('sawtooth', f, t, t1);
  keys(o.frequency, t, [[0, f], [dur * 0.45, f * rnd(0.65, 0.85)], [dur, f * rnd(1.05, 1.3)]]);
  const bp = s.f('bandpass', rnd(250, 350), 14);
  keys(bp.frequency, t, [[0, rnd(250, 350)], [dur, rnd(500, 800)]]);
  const am = s.g(0.5);
  const l = s.osc('sawtooth', rnd(14, 26), t, t1);
  const lg = s.g(0.5);
  l.connect(lg); lg.connect(am.gain);
  const g = s.g(0);
  env(g.gain, t, vol * 3, 0.12, dur);
  s.chain(o, bp, am, g, s.out);
}

function whistle(s, t, dur, f0, f1, vol) {
  s.tone({ t, dur, f: f0, f2: f1, vol, att: dur * 0.3, fmRate: 6, fmDepth: f0 * 0.012 });
  s.burst({ t, dur, color: 'white', f: (f0 + f1) / 2, q: 8, vol: vol * 0.7, att: dur * 0.3 });
}

function pad(s, t, n, gap, vol) {
  for (let i = 0; i < n; i++) {
    const ti = t + i * gap * rnd(0.85, 1.15);
    const w = i % 2 ? 0.8 : 1;
    s.burst({ t: ti, dur: 0.09, color: 'brown', type: 'lowpass', f: 420, vol: 0.7 * vol * w });
    s.tone({ t: ti, dur: 0.07, f: 230, f2: 105, vol: 0.3 * vol, fmRate: 60, fmDepth: 40 });
    s.burst({ t: ti + 0.02, dur: 0.035, color: 'pink', f: 1200, q: 3, vol: 0.18 * vol });
  }
}

function clicks(s, t, n, vol, gapA = 0.05, gapB = 0.2) {
  let ti = t;
  for (let i = 0; i < n; i++) {
    s.burst({ t: ti, dur: 0.018, f: rnd(1800, 3500), q: 10, vol: 0.9 * vol, att: 0.0006 });
    s.tone({ t: ti, dur: 0.05, f: rnd(280, 340), f2: 140, vol: 0.25 * vol, att: 0.001 });
    ti += rnd(gapA, gapB);
  }
  return ti;
}

function hoof(s, t, n, gap, vol) {
  for (let i = 0; i < n; i++) {
    const ti = t + Math.floor(i / 2) * gap + (i % 2) * gap * 0.35;
    s.tone({ t: ti, dur: 0.06, f: 300, f2: 140, vol: 0.5 * vol, att: 0.001 });
    s.burst({ t: ti, dur: 0.035, f: 2200, q: 4, vol: 0.6 * vol, att: 0.001 });
  }
}

function bleat(s, t, f, dur, vol) {
  formant(s, {
    t, dur, f0: [[0, f], [dur * 0.15, f * 1.15], [dur, f * 0.8]], vow: [[0, 'ae'], [dur, 'a']],
    amp: [[0, 0], [0.04, 1], [dur * 0.8, 0.8], [dur, 0]], vib: 60, vibRate: 9, breath: 0.3,
    dist: 4, q: [10, 12, 14], vol, thick: 1.012,
  });
}

function throb(s, t, dur, f, rate, vol) {
  const t1 = t + dur + 0.05;
  const o = s.osc('sawtooth', f, t, t1);
  const lp = s.f('lowpass', 500, 2);
  const am = s.g(0.5);
  const l = s.osc('sine', rate, t, t1);
  const lg = s.g(0.5);
  l.connect(lg); lg.connect(am.gain);
  const g = s.g(0);
  env(g.gain, t, vol, dur * 0.25, dur);
  s.chain(o, lp, am, g, s.out);
}

function hiss(s, t, dur, vol, f = 5200) {
  s.burst({ t, dur, f, q: 7, vol: vol * 1.2, att: dur * 0.2 });
  s.burst({ t, dur, type: 'highpass', f: 3800, vol: vol * 0.4, att: dur * 0.2 });
}

function thrum(s, t, dur, vol) {
  const t1 = t + dur + 0.05;
  for (const f of [38, 52, 96]) {
    const o = s.osc('sine', f, t, t1);
    const am = s.g(0.5);
    const l = s.osc('sine', 7 + f * 0.01, t, t1);
    const lg = s.g(0.5);
    l.connect(lg); lg.connect(am.gain);
    const g = s.g(0);
    env(g.gain, t, vol * (f > 90 ? 0.25 : 0.7), dur * 0.4, dur);
    s.chain(o, am, g, s.out);
  }
}

function squeal(s, t, dur, f0, f1, vol) {
  s.tone({ t, dur, type: 'sine', f: f0, f2: f1, vol, att: dur * 0.15, fmRate: 90, fmDepth: f0 * 0.4 });
  s.tone({ t, dur, type: 'square', f: f0 * 2, f2: f1 * 2, vol: vol * 0.08, att: dur * 0.15 });
}

/* ---------- the voices ---------- */

export const VOICES = {
  wendigo: {
    gain: 1.1, reverb: 0.5,
    idle(s) { howl(s, s.t0, 3, 300, 0.5); },
    alert(s) { howl(s, s.t0, 1.6, 420, 0.7, 1.5); growl(s, s.t0 + 0.2, 1, 80, 0.4, 14, 'o'); },
    chase(s) {
      const t = s.t0;
      formant(s, {
        t, dur: 1.2, f0: [[0, 180], [0.5, 300], [1.2, 240]], vow: [[0, 'a'], [1.2, 'o']],
        amp: [[0, 0], [0.05, 1], [0.9, 0.9], [1.2, 0]], vib: 40, vibRate: 8, breath: 0.5, dist: 8, vol: 0.9, thick: 1.01,
      });
      howl(s, t, 1.3, 520, 0.5, 1.4);
    },
    attack(s) {
      growl(s, s.t0, 1.1, 90, 1, 18, 'a', 12);
      s.burst({ dur: 0.35, f: 900, q: 0.8, vol: 0.6 });
    },
    special(s) { // distorted "hello?"
      const t = s.t0;
      formant(s, {
        t, dur: 1.25,
        f0: [[0, 105], [0.12, 118], [0.3, 112], [0.34, 100], [0.62, 126], [0.75, 150], [1.0, 215], [1.25, 250]],
        vow: [[0, 'e'], [0.2, 'e'], [0.3, 'ah'], [0.4, 'o'], [0.62, 'o'], [1.2, 'u']],
        amp: [[0, 0], [0.06, 0.8], [0.28, 0.9], [0.32, 0.25], [0.4, 0.9], [0.65, 0.9], [1.1, 0.7], [1.25, 0]],
        vib: 12, vibRate: 4.5, jitter: 25, breath: 0.35, dist: 6, thick: 1.01, vol: 1.3,
      });
      s.burst({ t, dur: 0.1, color: 'pink', f: 1800, q: 1, vol: 0.25 });
    },
  },

  skinwalker: {
    gain: 1, reverb: 0.4,
    idle(s) { yip(s, s.t0, 600, 0.3, 0.5); yip(s, s.t0 + 0.42, 700, 0.26, 0.4); },
    alert(s) {
      const t = s.t0;
      for (let i = 0; i < 4; i++) yip(s, t + i * 0.3, 600 + i * 70, 0.24, 0.7);
      laugh(s, t + 1.3, 2, 200, 0.2, 'a', 0.6);
    },
    chase(s) {
      for (let i = 0; i < 6; i++) yip(s, s.t0 + i * 0.2, rnd(750, 950), 0.17, 0.8);
    },
    attack(s) {
      const t = s.t0;
      shriek(s, t, 0.7, 700, 1500, 70, 300, 0.7);
      laugh(s, t + 0.2, 4, 240, 0.15, 'a', 0.9);
    },
    special(s) { // yips sliding into a human-ish laugh
      const t = s.t0;
      for (let i = 0; i < 3; i++) yip(s, t + i * 0.3, 640 + i * 80, 0.26, 0.8);
      formant(s, {
        t: t + 0.9, dur: 0.4, f0: [[0, 760], [0.4, 260]], vow: [[0, 'e'], [0.4, 'a']],
        amp: [[0, 0], [0.04, 1], [0.35, 0.8], [0.4, 0]], vib: 40, vibRate: 12, breath: 0.3, vol: 0.8,
      });
      laugh(s, t + 1.3, 6, 230, 0.17, 'a', 1.0, 0.95);
    },
  },

  dogman: {
    gain: 1.1, reverb: 0.3,
    idle(s) { growl(s, s.t0, 1.8, 58, 0.6, 24, 'o'); },
    alert(s) { growl(s, s.t0, 1.2, 70, 0.9, 28, 'a'); },
    chase(s) { const t = s.t0; for (let i = 0; i < 4; i++) bark(s, t + i * 0.3, 150 - i * 6, 0.9); growl(s, t + 1.2, 0.5, 80, 0.5, 30, 'a'); },
    attack(s) { growl(s, s.t0, 1.2, 75, 1, 32, 'a', 14); bark(s, s.t0 + 0.1, 130, 1); },
    special(s) { // low howl
      const t = s.t0;
      formant(s, {
        t, dur: 2.2, f0: [[0, 140], [0.5, 280], [1.4, 310], [2.2, 200]], vow: [[0, 'o'], [1, 'u'], [2.2, 'o']],
        amp: [[0, 0], [0.4, 1], [1.7, 0.9], [2.2, 0]], vib: 35, vibRate: 5, breath: 0.25, vol: 1, q: [12, 14, 16], thick: 1.008,
      });
    },
  },

  rake: {
    gain: 0.95, reverb: 0.3,
    idle(s) { clicks(s, s.t0, 6, 0.6); },
    alert(s) {
      const t = s.t0;
      const e = clicks(s, t, 12, 0.8, 0.03, 0.09);
      s.burst({ t: e, dur: 0.4, color: 'pink', f: 2200, f2: 900, q: 3, vol: 0.5, att: 0.1 });
    },
    chase(s) {
      const t = s.t0;
      s.burst({ t, dur: 1.4, color: 'pink', f: 1800, q: 4, vol: 0.5, att: 0.3 });
      clicks(s, t, 14, 0.7, 0.04, 0.12);
    },
    attack(s) { shriek(s, s.t0, 0.9, 1400, 2400, 110, 500, 0.9); clicks(s, s.t0, 8, 0.8, 0.03, 0.06); },
    special(s) { // shriek when lit
      const t = s.t0;
      shriek(s, t, 1.4, 1300, 2800, 130, 600, 1);
      s.burst({ t, dur: 1.2, f: 3500, q: 4, vol: 0.5, att: 0.05 });
    },
  },

  mothman: {
    gain: 1, reverb: 0.5,
    idle(s) { thrum(s, s.t0, 2.5, 0.8); s.burst({ dur: 0.3, color: 'brown', type: 'lowpass', f: 250, vol: 0.4, att: 0.1 }); },
    alert(s) { thrum(s, s.t0, 1.6, 1); squeal(s, s.t0 + 0.3, 0.9, 2400, 3100, 0.25); },
    chase(s) {
      const t = s.t0;
      for (let i = 0; i < 4; i++) {
        s.burst({ t: t + i * 0.22, dur: 0.2, color: 'brown', type: 'lowpass', f: 400, vol: 0.9, att: 0.05 });
        s.tone({ t: t + i * 0.22, dur: 0.16, f: 70, f2: 45, vol: 0.7 });
      }
      squeal(s, t, 0.5, 2800, 3600, 0.2);
      squeal(s, t + 0.55, 0.45, 3200, 2400, 0.2);
    },
    attack(s) { squeal(s, s.t0, 1.1, 3500, 1800, 0.45); s.burst({ dur: 0.4, f: 3000, q: 1, vol: 0.6 }); thrum(s, s.t0, 1.2, 1.2); },
    special(s) { // long electronic squeal
      const t = s.t0, d = 2.2;
      const o = s.osc('sine', 1800, t, t + d + 0.05);
      keys(o.frequency, t, [[0, 1800], [d * 0.5, 4200], [d, 1500]]);
      const m = s.osc('sine', 120, t, t + d + 0.05);
      const mg = s.g(500);
      m.connect(mg); mg.connect(o.frequency);
      const tr = s.osc('sine', 18, t, t + d + 0.05);
      const tg = s.g(0.3), ag = s.g(0.7);
      tr.connect(tg); tg.connect(ag.gain);
      const g = s.g(0);
      env(g.gain, t, 0.4, 0.5, d);
      s.chain(o, ag, g, s.out);
    },
  },

  jerseydevil: {
    gain: 1.1, reverb: 0.35,
    idle(s) {
      const t = s.t0;
      s.burst({ t, dur: 0.35, color: 'pink', f: 900, q: 2, vol: 0.7, att: 0.08 });
      s.burst({ t: t + 0.5, dur: 0.3, color: 'pink', f: 800, q: 2, vol: 0.6, att: 0.06 });
      growl(s, t + 0.2, 1, 70, 0.3, 14, 'o');
    },
    alert(s) {
      formant(s, {
        t: s.t0, dur: 0.9, f0: [[0, 420], [0.3, 800], [0.9, 600]], vow: [[0, 'e'], [0.9, 'a']],
        amp: [[0, 0], [0.05, 1], [0.7, 0.8], [0.9, 0]], vib: 70, vibRate: 11, breath: 0.4, dist: 4, vol: 0.9,
      });
    },
    chase(s) { const t = s.t0; hoof(s, t, 12, 0.18, 1); shriek(s, t + 0.3, 1.1, 1000, 1700, 90, 400, 0.7); },
    attack(s) { shriek(s, s.t0, 0.8, 1200, 2200, 100, 500, 1); growl(s, s.t0, 0.9, 80, 0.9, 30, 'a', 12); },
    special(s) { // long rising horse-scream telegraph
      const t = s.t0, d = 2.0;
      formant(s, {
        t, dur: d, f0: [[0, 300], [0.5, 480], [1.2, 800], [d, 1150]], vow: [[0, 'a'], [0.8, 'e'], [d, 'i']],
        amp: [[0, 0], [0.12, 0.8], [1.5, 1], [d - 0.05, 0.9], [d, 0]], vib: 50, vibRate: 9, jitter: 90,
        breath: 0.5, dist: 6, am: [40, 0.35], thick: 1.01, vol: 1.2, q: [9, 11, 13],
      });
      s.burst({ t, dur: d, f: 2800, f2: 5000, q: 2, vol: 0.35, att: 0.5 });
    },
  },

  notdeer: {
    gain: 0.8, reverb: 0.35,
    idle(s) { clicks(s, s.t0, 2, 0.35, 0.3, 0.9); },
    alert(s) { bleat(s, s.t0, 210, 0.9, 0.7); clicks(s, s.t0 + 0.6, 3, 0.5, 0.08, 0.2); },
    chase(s) { bleat(s, s.t0, 170, 0.6, 0.9); bleat(s, s.t0 + 0.7, 150, 0.6, 0.9); clicks(s, s.t0, 9, 0.6, 0.05, 0.15); },
    attack(s) {
      formant(s, {
        t: s.t0, dur: 1.2, f0: [[0, 150], [0.4, 600], [1.2, 900]], vow: [[0, 'ae'], [1.2, 'e']],
        amp: [[0, 0], [0.04, 1], [1.0, 1], [1.2, 0]], vib: 80, vibRate: 10, breath: 0.5, dist: 10, vol: 1, thick: 1.02,
      });
    },
    special(s) { // reversed bleat: swells then cuts
      const t = s.t0, d = 1.4;
      formant(s, {
        t, dur: d, f0: [[0, 130], [d, 260]], vow: [[0, 'ae'], [d, 'a']],
        amp: [[0, 0], [d - 0.03, 1], [d, 0]], vib: 60, vibRate: 9, breath: 0.3, dist: 4, vol: 0.9,
      });
    },
  },

  leshy: {
    gain: 1, reverb: 0.45,
    idle(s) { creak(s, s.t0, 1.5, 85, 0.5); },
    alert(s) {
      const t = s.t0;
      creak(s, t, 1.2, 70, 0.6); creak(s, t + 0.9, 1.4, 95, 0.6);
      s.tone({ t, dur: 2.2, type: 'sawtooth', f: 45, vol: 0.2, att: 0.6, filt: ['lowpass', 200, 1] });
    },
    chase(s) { creak(s, s.t0, 1.1, 60, 0.8); laugh(s, s.t0 + 0.3, 4, 85, 0.25, 'o', 0.8); },
    attack(s) {
      const t = s.t0;
      s.burst({ t, dur: 0.12, color: 'white', f: 1500, q: 0.8, vol: 1, att: 0.001 });
      s.tone({ t, dur: 0.4, f: 90, f2: 40, vol: 1 });
      creak(s, t + 0.05, 1.3, 55, 0.9);
    },
    special(s) { laugh(s, s.t0, 6, 88, 0.3, 'o', 1); creak(s, s.t0 + 0.2, 1.8, 75, 0.4); },
  },

  nightcrawler: {
    gain: 0.8, reverb: 0.3,
    idle(s) { pad(s, s.t0, 4, 0.45, 0.8); whistle(s, s.t0 + 0.2, 1.4, 900, 700, 0.08); },
    alert(s) { whistle(s, s.t0, 0.9, 700, 1400, 0.2); pad(s, s.t0 + 0.3, 3, 0.3, 0.8); },
    chase(s) { pad(s, s.t0, 9, 0.2, 1); whistle(s, s.t0, 1.5, 1100, 900, 0.14); },
    attack(s) {
      const t = s.t0;
      s.burst({ t, dur: 1, color: 'brown', type: 'lowpass', f: 500, vol: 1, att: 0.1 });
      s.tone({ t, dur: 1, f: 120, f2: 80, vol: 0.5, fmRate: 20, fmDepth: 40 });
      whistle(s, t, 0.8, 1800, 2600, 0.35);
    },
    special(s) { whistle(s, s.t0, 2, 800, 1300, 0.28); s.tone({ t: s.t0, dur: 2, f: 1600, f2: 2400, vol: 0.05, att: 0.6 }); },
  },

  banshee: {
    gain: 1.5, reverb: 0.65,
    idle(s) {
      const t = s.t0, d = 3;
      formant(s, {
        t, dur: d, f0: [[0, 620], [1.2, 540], [d, 480]], vow: [[0, 'o'], [1.5, 'u'], [d, 'o']],
        amp: [[0, 0], [1.0, 0.5], [2.2, 0.4], [d, 0]], vib: 40, vibRate: 5, breath: 0.5, vol: 0.5, q: [12, 14, 16], thick: 1.004,
      });
      s.burst({ t, dur: d, type: 'highpass', f: 4000, vol: 0.04, att: 1 });
    },
    alert(s) {
      formant(s, {
        t: s.t0, dur: 1.2, f0: [[0, 400], [1.2, 900]], vow: [[0, 'o'], [1.2, 'a']],
        amp: [[0, 0], [0.9, 1], [1.2, 0]], vib: 45, vibRate: 6, breath: 0.3, vol: 0.9, q: [10, 12, 14], thick: 1.004,
      });
    },
    chase(s) {
      formant(s, {
        t: s.t0, dur: 1.6, f0: [[0, 700], [0.8, 1100], [1.6, 900]], vow: [[0, 'a'], [1.6, 'e']],
        amp: [[0, 0], [0.2, 1], [1.4, 1], [1.6, 0]], vib: 55, vibRate: 6.5, breath: 0.3, dist: 3, vol: 1, thick: 1.004,
      });
    },
    attack(s) { shriek(s, s.t0, 1.2, 1100, 2000, 70, 300, 1); },
    special(s) { // THE wail, 2.5 s
      const t = s.t0, d = 2.5;
      const f0 = [[0, 380], [0.5, 620], [1.3, 1250], [2.0, 1700], [2.5, 1400]];
      const vow = [[0, 'o'], [0.6, 'a'], [1.3, 'e'], [2.0, 'i'], [2.5, 'a']];
      formant(s, {
        t, dur: d, f0, vow, amp: [[0, 0], [0.35, 0.5], [1.2, 1], [2.1, 1], [2.5, 0]],
        vib: 50, vibRate: 6, jitter: 20, breath: 0.3, dist: 5, vol: 1.2, q: [10, 14, 18], thick: 1.004,
      });
      formant(s, {
        t: t + 0.05, dur: d - 0.05, f0: f0.map(([a, b]) => [a, b * 1.5]), vow,
        amp: [[0, 0], [0.5, 0.4], [1.3, 0.6], [2.0, 0.6], [2.45, 0]], vib: 60, vibRate: 5.6, breath: 0.2, vol: 0.5, q: [10, 14, 18],
      });
      s.burst({ t, dur: d, type: 'highpass', f: 3500, vol: 0.12, att: 0.6 });
    },
  },

  flatwoods: {
    gain: 0.9, reverb: 0.35,
    idle(s) { hiss(s, s.t0, 1.8, 0.4); throb(s, s.t0, 1.8, 70, 3, 0.4); },
    alert(s) {
      const t = s.t0;
      hiss(s, t, 1.3, 0.6);
      for (let i = 0; i < 6; i++) s.burst({ t: t + rnd(0, 1.1), dur: 0.02, type: 'highpass', f: 3000, vol: 0.7, att: 0.0008 });
    },
    chase(s) {
      const t = s.t0;
      throb(s, t, 2, 60, 11, 0.7);
      hiss(s, t, 2, 0.5, 6000);
      s.tone({ t, dur: 2, type: 'sawtooth', f: 90, f2: 180, vol: 0.12, att: 1, filt: ['lowpass', 700, 1] });
    },
    attack(s) {
      const t = s.t0;
      const o = s.osc('sawtooth', 120, t, t + 1.1);
      const sh = s.shaper(50), g = s.g(0);
      env(g.gain, t, 0.7, 0.01, 1);
      s.chain(o, sh, g, s.out);
      s.burst({ t, dur: 0.5, f: 3000, q: 0.7, vol: 0.9 });
      hiss(s, t, 1, 0.5);
    },
    special(s) { // ring-mod metallic sweep
      const t = s.t0, d = 1.8;
      const car = s.osc('sine', 400, t, t + d + 0.05);
      keys(car.frequency, t, [[0, 400], [d, 1200]]);
      const mod = s.osc('sine', 130, t, t + d + 0.05);
      const rm = s.g(0);
      mod.connect(rm.gain);
      const g = s.g(0);
      env(g.gain, t, 0.9, 0.4, d);
      s.chain(car, rm, g, s.out);
      hiss(s, t, d, 0.3);
    },
  },

  llorona: {
    gain: 1.1, reverb: 0.6,
    idle(s) { sob(s, s.t0, 340, 0.6); },
    alert(s) { sob(s, s.t0, 360, 0.7); sob(s, s.t0 + 0.55, 330, 0.7); },
    chase(s) { // sobbing that breaks into a scream (short)
      const t = s.t0;
      sob(s, t, 350, 0.8); sob(s, t + 0.5, 380, 0.8);
      formant(s, {
        t: t + 1.0, dur: 1.0, f0: [[0, 500], [0.2, 1100], [1.0, 1500]], vow: [[0, 'a'], [1.0, 'e']],
        amp: [[0, 0], [0.04, 1], [0.8, 1], [1.0, 0]], vib: 60, vibRate: 7, breath: 0.4, dist: 8, vol: 1, q: [10, 12, 14],
      });
    },
    attack(s) {
      formant(s, {
        t: s.t0, dur: 1.2, f0: [[0, 600], [0.3, 1500], [1.2, 1800]], vow: [[0, 'a'], [1.2, 'i']],
        amp: [[0, 0], [0.03, 1], [1.0, 1], [1.2, 0]], vib: 70, vibRate: 8, breath: 0.5, dist: 12, vol: 1.1, thick: 1.01,
      });
    },
    special(s) { // sobbing breaking into a long scream
      const t = s.t0;
      sob(s, t, 340, 0.8); sob(s, t + 0.55, 360, 0.85); sob(s, t + 1.0, 390, 0.9);
      const st = t + 1.5, d = 1.9;
      formant(s, {
        t: st, dur: d, f0: [[0, 420], [0.15, 1000], [0.9, 1500], [d, 1250]], vow: [[0, 'o'], [0.2, 'a'], [1.0, 'e'], [d, 'a']],
        amp: [[0, 0], [0.03, 1], [d - 0.3, 1], [d, 0]], vib: 80, vibRate: 7.5, jitter: 40, breath: 0.45, dist: 9, vol: 1.2,
        thick: 1.008, q: [10, 13, 16],
      });
      s.burst({ t: st, dur: d, type: 'highpass', f: 3000, vol: 0.14, att: 0.1 });
    },
  },
};
