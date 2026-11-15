// One-shot sound recipes. Each entry: { vol, reverb, fn(shot) }.
import { rnd, pick, keys } from './synth.js';

function twig(s) {
  const t = s.t0, p = s.pitch;
  s.burst({ t, dur: 0.035, f: 2600 * p, q: 2, vol: 0.9, att: 0.001 });
  s.burst({ t: t + rnd(0.02, 0.045), dur: 0.025, f: 3800 * p, q: 3, vol: 0.5, att: 0.001 });
  s.tone({ t, dur: 0.06, type: 'triangle', f: 240 * p, f2: 120, vol: 0.3 });
}

function knock(s) {
  const n = pick([2, 3, 3]);
  let t = s.t0;
  for (let i = 0; i < n; i++) {
    const f = rnd(150, 230);
    s.tone({ t, dur: 0.12, type: 'triangle', f, f2: f * 0.55, vol: 0.9, att: 0.002 });
    s.burst({ t, dur: 0.04, f: 900, q: 1.5, vol: 0.4, att: 0.001 });
    t += rnd(0.22, 0.6);
  }
}

export const SFX = {
  footstep: {
    vol: 0.8, reverb: 0.05,
    fn(s) {
      const p = s.pitch * rnd(0.9, 1.12), t = s.t0;
      s.tone({ t, dur: 0.13, f: rnd(85, 110) * p, f2: 48, vol: 0.55 });
      s.burst({ t, dur: 0.11, color: 'pink', f: rnd(1800, 2800) * p, q: 0.7, vol: 0.4, att: 0.004 });
      s.burst({ t: t + rnd(0.02, 0.05), dur: 0.07, f: rnd(3500, 5500), q: 1.2, vol: 0.14 });
      s.burst({ t, dur: 0.08, color: 'brown', type: 'lowpass', f: 220, vol: 0.5 });
    },
  },
  footstep_crouch: {
    vol: 0.4, reverb: 0.03,
    fn(s) {
      const p = s.pitch * rnd(0.9, 1.1), t = s.t0;
      s.tone({ t, dur: 0.14, f: rnd(65, 80) * p, f2: 40, vol: 0.5 });
      s.burst({ t, dur: 0.12, color: 'pink', f: rnd(900, 1300) * p, q: 0.6, vol: 0.3, att: 0.008 });
      s.burst({ t, dur: 0.09, color: 'brown', type: 'lowpass', f: 160, vol: 0.4 });
    },
  },
  rock_throw: {
    vol: 0.7, reverb: 0.08,
    fn(s) {
      const p = s.pitch;
      s.burst({ dur: 0.4, color: 'pink', f: 350 * p, f2: 1900 * p, q: 1.4, vol: 0.7, att: 0.12 });
      s.burst({ dur: 0.3, color: 'white', type: 'highpass', f: 3000, vol: 0.08, att: 0.1 });
    },
  },
  rock_impact: {
    vol: 1, reverb: 0.5,
    fn(s) {
      const p = s.pitch, t = s.t0;
      s.burst({ t, dur: 0.05, f: 3200 * p, q: 3, vol: 0.9, att: 0.001 });
      s.tone({ t, dur: 0.07, type: 'triangle', f: 1500 * p, f2: 650 * p, vol: 0.3, att: 0.001 });
      s.tone({ t, dur: 0.28, f: 135 * p, f2: 55, vol: 0.9 });
      s.burst({ t, dur: 0.3, color: 'brown', type: 'lowpass', f: 300, vol: 0.6 });
      s.burst({ t: t + 0.05, dur: 0.08, color: 'pink', f: 1800, q: 1, vol: 0.25 });
    },
  },
  slingshot: {
    vol: 0.8, reverb: 0.1,
    fn(s) {
      const p = s.pitch, t = s.t0;
      s.tone({ t, dur: 0.42, type: 'triangle', f: 640 * p, f2: 160 * p, vol: 0.55, fmRate: 55, fmDepth: 70 });
      s.tone({ t, dur: 0.3, f: 1280 * p, f2: 320 * p, vol: 0.15, fmRate: 55, fmDepth: 120 });
      s.burst({ t, dur: 0.04, type: 'highpass', f: 2500, vol: 0.7, att: 0.001 });
      s.burst({ t, dur: 0.25, f: 1200, f2: 300, q: 2, vol: 0.2 });
    },
  },
  pickup: {
    vol: 0.5, reverb: 0.15,
    fn(s) {
      const p = s.pitch, t = s.t0;
      s.tone({ t, dur: 0.16, type: 'triangle', f: 660 * p, vol: 0.5, att: 0.006 });
      s.tone({ t: t + 0.07, dur: 0.24, type: 'triangle', f: 990 * p, vol: 0.45, att: 0.006 });
      s.burst({ t, dur: 0.08, color: 'pink', f: 3000, q: 1, vol: 0.12 });
    },
  },
  flashlight_click: {
    vol: 0.7, reverb: 0.04,
    fn(s) {
      const t = s.t0;
      s.burst({ t, dur: 0.02, type: 'highpass', f: 1800, vol: 0.7, att: 0.0008 });
      s.tone({ t, dur: 0.03, type: 'square', f: 2000, f2: 900, vol: 0.25, att: 0.001 });
      s.burst({ t: t + 0.05, dur: 0.018, type: 'highpass', f: 1500, vol: 0.4, att: 0.0008 });
    },
  },
  battery: {
    vol: 0.7, reverb: 0.1,
    fn(s) {
      const t = s.t0;
      s.tone({ t, dur: 0.18, type: 'triangle', f: 1800, f2: 1500, vol: 0.3, att: 0.001 });
      s.tone({ t, dur: 0.12, type: 'sine', f: 2640, vol: 0.12, att: 0.001 });
      s.burst({ t, dur: 0.05, f: 4000, q: 2, vol: 0.4, att: 0.001 });
      s.tone({ t: t + 0.04, dur: 0.1, f: 210, f2: 120, vol: 0.5 });
      s.burst({ t: t + 0.13, dur: 0.02, type: 'highpass', f: 1800, vol: 0.5, att: 0.001 });
      s.tone({ t: t + 0.13, dur: 0.09, f: 160, f2: 90, vol: 0.4 });
    },
  },
  stinger: {
    vol: 0.9, reverb: 0.35,
    fn(s) {
      const t = s.t0;
      const lp = s.f('lowpass', 4000, 2);
      keys(lp.frequency, t, [[0, 4000], [1.6, 300]]);
      const mix = s.g(0.07);
      const sh = s.shaper(8);
      const g = s.g(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.9, t + 0.008);
      g.gain.setTargetAtTime(0, t + 0.05, 0.35);
      for (const f of [55, 58.3, 82.4, 87.3, 116.5, 123.5, 164.8, 233]) {
        for (const dc of [-9, 11]) {
          const o = s.osc('sawtooth', f, t, t + 2);
          o.detune.value = dc;
          o.connect(mix);
        }
      }
      s.chain(mix, lp, sh, g, s.out);
      s.burst({ t, dur: 0.55, color: 'white', type: 'lowpass', f: 7000, f2: 900, vol: 0.8, att: 0.002 });
      s.tone({ t, dur: 1.5, f: 95, f2: 26, vol: 1.1, att: 0.004 });
    },
  },
  identify: {
    vol: 0.55, reverb: 0.7,
    fn(s) {
      const t = s.t0, p = s.pitch;
      // reversed swell: rises then cuts
      const n = s.noise(t, t + 1.3, 'pink');
      const bp = s.f('bandpass', 700, 4);
      keys(bp.frequency, t, [[0, 500], [1.2, 1400]]);
      const g = s.g(0);
      keys(g.gain, t, [[0, 0], [1.2, 1.2], [1.23, 0]], false);
      s.chain(n, bp, g, s.out);
      s.tone({ t, dur: 1.25, type: 'triangle', f: 220 * p, f2: 330 * p, vol: 0.0, att: 0.01 });
      // bell
      const bt = t + 1.2;
      [[1, 1], [2.76, 0.5], [5.4, 0.28], [8.93, 0.12]].forEach(([m, a]) => {
        s.tone({ t: bt, dur: 2.2 / Math.sqrt(m), f: 523 * p * m, vol: 0.22 * a, att: 0.003 });
      });
    },
  },
  death: {
    vol: 1, reverb: 0.15,
    fn(s) {
      const t = s.t0, cut = 1.25;
      const sh = s.shaper(80);
      const g = s.g(0);
      keys(g.gain, t, [[0, 0], [0.12, 0.6], [0.9, 1], [cut - 0.012, 1], [cut, 0]], false);
      const n = s.noise(t, t + cut + 0.05, 'white');
      const bp = s.f('bandpass', 200, 1.2);
      keys(bp.frequency, t, [[0, 200], [0.9, 1600], [cut, 2400]]);
      s.chain(n, bp, sh);
      const mix = s.g(0.3);
      for (const f of [58, 61, 87]) {
        const o = s.osc('sawtooth', f, t, t + cut + 0.05);
        keys(o.frequency, t, [[0, f], [cut, f * 0.6]]);
        o.connect(mix);
      }
      mix.connect(sh);
      sh.connect(g);
      g.connect(s.out);
      const sub = s.osc('sine', 52, t, t + cut + 0.05);
      keys(sub.frequency, t, [[0, 52], [cut, 28]]);
      const sg = s.g(0);
      keys(sg.gain, t, [[0, 0], [0.3, 0.9], [cut - 0.012, 0.9], [cut, 0]], false);
      s.chain(sub, sg, s.out);
    },
  },
  wardstone: {
    vol: 0.7, reverb: 0.75,
    fn(s) {
      const t = s.t0;
      s.tone({ t, dur: 3.2, type: 'triangle', f: 98, vol: 0.7, att: 0.6 });
      s.tone({ t, dur: 3.2, type: 'sine', f: 147, vol: 0.4, att: 0.7 });
      const n = s.noise(t, t + 3.2, 'pink');
      const bp = s.f('bandpass', 220, 25);
      const g = s.g(0);
      keys(g.gain, t, [[0, 0], [0.8, 1.2], [3.1, 0]], false);
      s.chain(n, bp, g, s.out);
      const ct = t + 1.2;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        s.tone({ t: ct + i * 0.09, dur: 2.6, f, vol: 0.14, att: 0.5, fmRate: 5 + i, fmDepth: 2 });
        s.tone({ t: ct + i * 0.09, dur: 2.0, f: f * 2.003, vol: 0.05, att: 0.6 });
      });
    },
  },
  wardstone_all: {
    vol: 0.9, reverb: 0.85,
    fn(s) {
      const t = s.t0;
      s.tone({ t, dur: 5.2, f: 55, vol: 0.8, att: 1.4 });
      s.tone({ t, dur: 5.2, type: 'triangle', f: 110, vol: 0.4, att: 1.6 });
      const n = s.noise(t, t + 4.5, 'white');
      const hp = s.f('highpass', 4000, 0.7);
      const g = s.g(0);
      keys(g.gain, t, [[0, 0], [2.2, 0.22], [4.4, 0]], false);
      s.chain(n, hp, g, s.out);
      [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        const at = t + 0.9 + i * 0.22;
        s.tone({ t: at, dur: 3.6, f, vol: 0.13, att: 0.7, fmRate: 4.5 + i * 0.4, fmDepth: 2.5 });
        s.tone({ t: at, dur: 2.6, f: f * 2.005, vol: 0.04, att: 0.8 });
      });
    },
  },
  ui_click: {
    vol: 0.45, reverb: 0,
    fn(s) {
      s.tone({ dur: 0.06, f: 1200, f2: 800, vol: 0.5, att: 0.002 });
      s.burst({ dur: 0.012, type: 'highpass', f: 3000, vol: 0.3, att: 0.0008 });
    },
  },
  breath: {
    vol: 0.6, reverb: 0.1,
    fn(s) {
      const t = s.t0, p = s.pitch;
      // gasp in
      s.burst({ t, dur: 0.5, color: 'pink', f: 600 * p, f2: 1500 * p, q: 1.1, vol: 0.9, att: 0.28 });
      s.burst({ t, dur: 0.45, color: 'white', type: 'highpass', f: 3500, vol: 0.06, att: 0.3 });
      // ragged exhale
      s.burst({ t: t + 0.55, dur: 0.65, color: 'pink', f: 1200 * p, f2: 450 * p, q: 1, vol: 0.6, att: 0.08 });
    },
  },
  twig: { vol: 0.8, reverb: 0.25, fn: twig },
};

export const AMB_TWIG = twig;
export const AMB_KNOCK = knock;
