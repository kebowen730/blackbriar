// Continuous positional loops. LOOPS[name](rig) builds the graph into rig.out and may set rig.tick(now, dt).
import { Rig, makePanner, setPannerPos, rnd, pick, clamp, VOW } from './synth.js';

const LOOPS = {
  weeping(L) {
    const ac = L.ac;
    const o1 = L.loopOsc('sawtooth', 320), o2 = L.loopOsc('sawtooth', 321.5);
    const src = L.g(0.5);
    o1.connect(src); o2.connect(src);
    const amp = L.g(0);
    const sum = L.g(3);
    const bps = [];
    [10, 12, 14].forEach((q, i) => {
      const b = L.f('bandpass', VOW.a[i], q);
      bps.push(b);
      src.connect(b); b.connect(sum);
    });
    // shaky vibrato
    const vib = L.loopOsc('sine', 8.5), vg = L.g(25);
    vib.connect(vg); vg.connect(o1.detune); vg.connect(o2.detune);
    sum.connect(amp); amp.connect(L.out);
    // breath
    const bn = L.loopNoise('pink');
    const bb = L.f('bandpass', 1700, 1);
    const bg = L.g(0);
    L.chain(bn, bb, bg, L.out);
    let next = ac.currentTime + 0.1;
    L.tick = (now) => {
      let guard = 0;
      while (next < now + 0.6 && guard++ < 4) {
        let tt = next;
        const pulses = 2 + ((Math.random() * 4) | 0);
        for (let p = 0; p < pulses; p++) {
          const d = rnd(0.2, 0.38), f = rnd(280, 380) * (p === 0 ? 1.1 : 1);
          // inhale
          bg.gain.setValueAtTime(0, tt);
          bg.gain.linearRampToValueAtTime(0.25, tt + 0.07);
          bg.gain.linearRampToValueAtTime(0, tt + 0.14);
          const vt = tt + 0.08;
          for (const [o, m] of [[o1, 1], [o2, 1.005]]) {
            o.frequency.setValueAtTime(f * m, vt);
            o.frequency.exponentialRampToValueAtTime(f * m * rnd(0.78, 0.92), vt + d);
          }
          bps.forEach((b, i) => {
            b.frequency.setValueAtTime(VOW.a[i], vt);
            b.frequency.linearRampToValueAtTime(VOW.o[i], vt + d);
          });
          amp.gain.setValueAtTime(0, vt);
          amp.gain.linearRampToValueAtTime(0.55, vt + 0.04);
          amp.gain.linearRampToValueAtTime(0.25, vt + d * 0.6);
          amp.gain.linearRampToValueAtTime(0, vt + d);
          tt = vt + d + rnd(0.08, 0.3);
        }
        next = tt + (Math.random() < 0.4 ? rnd(2.5, 5) : rnd(0.6, 1.6));
      }
    };
  },

  hum(L) {
    const mix = L.g(0.5);
    for (const [f, a] of [[55, 0.5], [55.45, 0.5], [110.2, 0.25], [109.8, 0.25], [220.6, 0.1]]) {
      const o = L.loopOsc('sine', f);
      const g = L.g(a);
      o.connect(g); g.connect(mix);
    }
    const sw = L.loopOsc('sawtooth', 165);
    const lp = L.f('lowpass', 300, 1);
    const sg = L.g(0.08);
    L.chain(sw, lp, sg, mix);
    for (const f of [1500, 1504.5]) {
      const o = L.loopOsc('sine', f);
      const g = L.g(0.015);
      o.connect(g); g.connect(mix);
    }
    const tm = L.g(0.8);
    const l = L.loopOsc('sine', 0.3), lg = L.g(0.2);
    l.connect(lg); lg.connect(tm.gain);
    const n = L.loopNoise('white');
    const hp = L.f('highpass', 3000, 0.7);
    const ng = L.g(0.006);
    L.chain(n, hp, ng, mix);
    L.chain(mix, tm, L.out);
  },

  wings(L) {
    const ac = L.ac;
    const n = L.loopNoise('pink');
    const bp = L.f('bandpass', 250, 1.2);
    const ng = L.g(0);
    L.chain(n, bp, ng, L.out);
    const n2 = L.loopNoise('white');
    const bp2 = L.f('bandpass', 1400, 1.5);
    const ng2 = L.g(0);
    L.chain(n2, bp2, ng2, L.out);
    const th = L.loopOsc('sine', 48);
    const tg = L.g(0);
    L.chain(th, tg, L.out);
    let next = ac.currentTime + 0.1;
    L.tick = (now) => {
      let guard = 0;
      while (next < now + 0.6 && guard++ < 4) {
        const t = next;
        ng.gain.setValueAtTime(0, t);
        ng.gain.linearRampToValueAtTime(2.2, t + 0.1);
        ng.gain.linearRampToValueAtTime(0, t + 0.38);
        bp.frequency.setValueAtTime(220, t);
        bp.frequency.exponentialRampToValueAtTime(620, t + 0.15);
        bp.frequency.exponentialRampToValueAtTime(240, t + 0.4);
        ng2.gain.setValueAtTime(0, t);
        ng2.gain.linearRampToValueAtTime(0.2, t + 0.08);
        ng2.gain.linearRampToValueAtTime(0, t + 0.3);
        tg.gain.setValueAtTime(0, t + 0.06);
        tg.gain.linearRampToValueAtTime(0.9, t + 0.12);
        tg.gain.linearRampToValueAtTime(0, t + 0.32);
        next = t + rnd(0.5, 0.65) + (Math.random() < 0.15 ? 0.25 : 0);
      }
    };
  },

  siren_whisper(L) {
    const ac = L.ac;
    const n = L.loopNoise('white');
    const sum = L.g(4);
    const bps = [];
    [6, 8, 10].forEach((q, i) => {
      const b = L.f('bandpass', VOW.a[i], q);
      bps.push(b);
      n.connect(b); b.connect(sum);
    });
    const amp = L.g(0);
    L.chain(sum, amp, L.out);
    // faint wavering siren song
    const s1 = L.loopOsc('sine', 740), s2 = L.loopOsc('sine', 746);
    const sg = L.g(0.02);
    s1.connect(sg); s2.connect(sg); sg.connect(L.out);
    const vl = L.loopOsc('sine', 4.5), vg = L.g(6);
    vl.connect(vg); vg.connect(s1.detune); vg.connect(s2.detune);
    const notes = [587, 659, 740, 880, 988, 740];
    let next = ac.currentTime + 0.05, nextNote = ac.currentTime;
    L.tick = (now) => {
      let guard = 0;
      while (next < now + 0.5 && guard++ < 6) {
        const t = next, vow = VOW[pick(['a', 'o', 'u', 'e', 'i', 'ae'])];
        bps.forEach((b, i) => b.frequency.setTargetAtTime(vow[i], t, 0.03));
        const d = rnd(0.12, 0.3);
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(rnd(0.6, 1), t + 0.03);
        amp.gain.linearRampToValueAtTime(0, t + d);
        next = t + d + (Math.random() < 0.18 ? rnd(0.5, 1.2) : rnd(0.02, 0.12));
      }
      if (now > nextNote) {
        nextNote = now + rnd(2, 4);
        const f = pick(notes);
        s1.frequency.setTargetAtTime(f, now, 0.6);
        s2.frequency.setTargetAtTime(f * 1.008, now, 0.6);
      }
    };
  },

  growl(L) {
    const o1 = L.loopOsc('sawtooth', 62), o2 = L.loopOsc('sawtooth', 63.7);
    const mix = L.g(0.5);
    o1.connect(mix); o2.connect(mix);
    const am = L.g(0.5);
    const l = L.loopOsc('sine', 23), lg = L.g(0.5);
    l.connect(lg); lg.connect(am.gain);
    const sh = L.shaper(10);
    const lp = L.f('lowpass', 700, 1);
    const br = L.g(0.55);
    const bl = L.loopOsc('sine', 0.45), bg = L.g(0.45);
    bl.connect(bg); bg.connect(br.gain);
    L.chain(mix, am, sh, lp, br, L.out);
    const n = L.loopNoise('brown');
    const nlp = L.f('lowpass', 300, 1);
    const ng = L.g(0.3);
    L.chain(n, nlp, ng, br);
    let nextP = 0;
    L.tick = (now) => {
      if (now < nextP) return;
      nextP = now + 0.5;
      const f = rnd(52, 78);
      o1.frequency.setTargetAtTime(f, now, 0.3);
      o2.frequency.setTargetAtTime(f * 1.027, now, 0.3);
    };
  },

  static(L) {
    const ac = L.ac;
    const n = L.loopNoise('white');
    const bp = L.f('bandpass', 3500, 0.6);
    const hp = L.f('highpass', 800, 0.7);
    const cg = L.g(0.3);
    L.chain(n, bp, hp, cg, L.out);
    for (const f of [50, 100]) {
      const o = L.loopOsc('sine', f);
      const g = L.g(0.02);
      L.chain(o, g, L.out);
    }
    let next = ac.currentTime;
    L.tick = (now) => {
      let guard = 0;
      while (next < now + 0.2 && guard++ < 8) {
        const t = next;
        cg.gain.setValueAtTime(rnd(0.1, 1) * (Math.random() < 0.1 ? 1.8 : 1) * 0.5, t);
        bp.frequency.setValueAtTime(rnd(1500, 6000), t);
        next = t + rnd(0.04, 0.2);
      }
    };
  },
};

export function hasLoop(name) { return Object.prototype.hasOwnProperty.call(LOOPS, name); }

/** Build a loop; returns handle {setPos,setVolume,stop}. */
export function createLoop(E, name, o = {}) {
  const L = new Rig(E);
  const ac = E.ac;
  const base = o.volume ?? 1;
  L.out = L.g(0);
  let tail = L.out, panner = null;
  if (o.pos) {
    panner = L.n(makePanner(E, o.pos));
    L.out.connect(panner);
    tail = panner;
  }
  tail.connect(E.master);
  const sg = L.g(0.18);
  tail.connect(sg); sg.connect(E.reverbIn);
  L.tick = null;
  LOOPS[name](L);
  L.out.gain.setTargetAtTime(base, ac.currentTime, 0.25);
  E.loops.add(L);
  let stopped = false;
  L.dispose2 = () => { L.dispose(); E.loops.delete(L); };
  const handle = {
    setPos(v) { if (!stopped && panner && v) setPannerPos(panner, v, ac, 0.05); },
    setVolume(v) { if (!stopped) L.out.gain.setTargetAtTime(clamp(+v || 0, 0, 4), ac.currentTime, 0.12); },
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ac.currentTime;
      L.out.gain.cancelScheduledValues(t);
      L.out.gain.setTargetAtTime(0, t, 0.12);
      setTimeout(L.dispose2, 800);
    },
  };
  L.stopFn = handle.stop;
  return handle;
}
