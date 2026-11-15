// Night-forest ambience bed, tension drone and heartbeat.
import { rnd, pick, clamp, keys, spawn } from './synth.js';
import { AMB_TWIG, AMB_KNOCK } from './sfx.js';

function creakRecipe(s) {
  const t = s.t0, d = rnd(0.9, 2.2), f = rnd(70, 130), t1 = t + d + 0.05;
  const o = s.osc('sawtooth', f, t, t1);
  keys(o.frequency, t, [[0, f], [d * 0.5, f * rnd(0.7, 1.4)], [d, f * rnd(0.8, 1.2)]]);
  const bp = s.f('bandpass', rnd(250, 500), 14);
  keys(bp.frequency, t, [[0, rnd(250, 400)], [d, rnd(500, 900)]]);
  const am = s.g(0.5);
  const l = s.osc('sawtooth', rnd(14, 30), t, t1);
  const lg = s.g(0.5);
  l.connect(lg); lg.connect(am.gain);
  const g = s.g(0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1.5, t + d * 0.3);
  g.gain.linearRampToValueAtTime(0, t + d);
  s.chain(o, bp, am, g, s.out);
}

function owlRecipe(s) {
  const t = s.t0, base = rnd(330, 420);
  const times = pick([[0, 0.55, 1.15], [0, 0.45, 0.9, 2.0], [0, 0.7]]);
  times.forEach((at, i) => {
    const last = i === times.length - 1;
    s.tone({ t: t + at, dur: last ? 0.65 : 0.36, f: base, f2: base * 0.82, vol: 0.5, att: 0.07 });
    s.tone({ t: t + at, dur: last ? 0.5 : 0.3, f: base * 2, f2: base * 1.64, vol: 0.08, att: 0.07 });
  });
}

function heartRecipe(s, gap) {
  const t = s.t0;
  s.tone({ t, dur: 0.18, f: 64, f2: 38, vol: 1, att: 0.006 });
  s.tone({ t, dur: 0.1, type: 'triangle', f: 130, f2: 70, vol: 0.28, att: 0.004 });
  s.burst({ t, dur: 0.1, color: 'brown', type: 'lowpass', f: 150, vol: 0.5, att: 0.004 });
  const t2 = t + gap;
  s.tone({ t: t2, dur: 0.16, f: 54, f2: 34, vol: 0.75, att: 0.006 });
  s.tone({ t: t2, dur: 0.09, type: 'triangle', f: 110, f2: 62, vol: 0.2, att: 0.004 });
  s.burst({ t: t2, dur: 0.08, color: 'brown', type: 'lowpass', f: 130, vol: 0.4, att: 0.004 });
}

export function createAmbience(E) {
  let inst = null;
  const timers = { creak: rnd(4, 9), owl: rnd(15, 35), snap: rnd(10, 25), silence: rnd(35, 80) };

  function build() {
    const ac = E.ac, t = ac.currentTime;
    const I = { nodes: [], srcs: [], cb: null, out: null };
    const reg = (n) => { I.nodes.push(n); return n; };
    const gain = (v) => { const g = reg(ac.createGain()); g.gain.value = v; return g; };
    const filt = (type, f, q = 1) => { const x = reg(ac.createBiquadFilter()); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
    const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(); I.srcs.push(o); I.nodes.push(o); return o; };
    const noise = (color) => {
      const b = ac.createBufferSource(); b.buffer = E.noise[color]; b.loop = true;
      b.start(0, Math.random() * b.buffer.duration); I.srcs.push(b); I.nodes.push(b); return b;
    };
    const lfo = (rate, depth, param) => { const l = osc('sine', rate); const g = gain(depth); l.connect(g); g.connect(param); };

    I.out = gain(0);
    I.out.connect(E.master);
    I.out.gain.setTargetAtTime(1, t, 1.5);

    // wind: low rumble with slow gusts
    let n = noise('brown');
    let lp = filt('lowpass', 420, 0.7);
    let g = gain(0.2);
    n.connect(lp); lp.connect(g); g.connect(I.out);
    lfo(0.07, 0.12, g.gain); lfo(0.13, 0.05, g.gain); lfo(0.05, 150, lp.frequency);
    // wind: mid howl
    n = noise('pink');
    let bp = filt('bandpass', 650, 2.5);
    g = gain(0.05);
    n.connect(bp); bp.connect(g); g.connect(I.out);
    lfo(0.04, 250, bp.frequency); lfo(0.09, 0.03, g.gain);
    // needle hiss
    n = noise('white');
    const hp = filt('highpass', 5500, 0.7);
    g = gain(0.012);
    n.connect(hp); hp.connect(g); g.connect(I.out);
    lfo(0.11, 0.006, g.gain);

    // crickets
    I.cb = gain(1);
    I.cb.connect(I.out);
    for (let i = 0; i < 5; i++) {
      const car = osc('sine', rnd(3900, 5400));
      const am = gain(0.5);
      lfo(rnd(11, 20), 0.5, am.gain);
      const gate = gain(0.5);
      lfo(rnd(0.15, 0.5), 0.5, gate.gain);
      const lev = gain(rnd(0.005, 0.009));
      I.nodes.push(car);
      car.connect(am); am.connect(gate); gate.connect(lev); lev.connect(I.cb);
    }
    return I;
  }

  function teardown(I) {
    for (const s of I.srcs) { try { s.stop(); } catch (e) { /* ignore */ } }
    for (const n of I.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
  }

  return {
    start() {
      if (inst || !E.ac) return;
      inst = build();
    },
    stop() {
      if (!inst) return;
      const I = inst;
      inst = null;
      const t = E.ac.currentTime;
      I.out.gain.cancelScheduledValues(t);
      I.out.gain.setTargetAtTime(0, t, 0.4);
      setTimeout(() => teardown(I), 3000);
    },
    update(dt) {
      if (!inst || !E.ac || E.ac.state !== 'running') return;
      for (const k in timers) timers[k] -= dt;
      if (timers.creak <= 0) {
        timers.creak = rnd(6, 18);
        spawn(E, creakRecipe, { pos: E.ringPos(8, 35), volume: rnd(0.4, 0.9), reverb: 0.4 });
      }
      if (timers.owl <= 0) {
        timers.owl = rnd(25, 65);
        spawn(E, owlRecipe, { pos: E.ringPos(30, 70), volume: 0.8, reverb: 0.6 });
      }
      if (timers.snap <= 0) {
        timers.snap = rnd(15, 45);
        spawn(E, Math.random() < 0.65 ? AMB_TWIG : AMB_KNOCK, { pos: E.ringPos(20, 50), volume: rnd(0.5, 0.9), reverb: 0.5 });
      }
      if (timers.silence <= 0) {
        timers.silence = rnd(40, 90);
        const t = E.ac.currentTime, d = rnd(3, 8);
        const p = inst.cb.gain;
        p.cancelScheduledValues(t);
        p.setTargetAtTime(0, t, 0.35);
        p.setTargetAtTime(1, t + d, 1.2);
      }
    },
  };
}

export function createTension(E) {
  const ac = E.ac;
  const nodes = [], srcs = [];
  const reg = (n) => { nodes.push(n); return n; };
  const gain = (v) => { const g = reg(ac.createGain()); g.gain.value = v; return g; };
  const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(); srcs.push(o); nodes.push(o); return o; };

  // dissonant drone: tritone + minor-second cluster through an opening lowpass
  const lp = reg(ac.createBiquadFilter());
  lp.type = 'lowpass'; lp.frequency.value = 110; lp.Q.value = 1.2;
  const dg = gain(0);
  lp.connect(dg); dg.connect(E.master);
  for (const f of [55, 58.27, 77.78, 82.41, 110.5]) {
    const o = osc('sawtooth', f);
    o.detune.value = rnd(-12, 12);
    const g = gain(0.2);
    o.connect(g); g.connect(lp);
  }
  const ll = osc('sine', 0.1), llg = gain(40);
  ll.connect(llg); llg.connect(lp.frequency);

  // faint high string-like whine
  const wg = gain(0);
  wg.connect(E.master);
  const vib = osc('sine', 5.5), vg = gain(8);
  vib.connect(vg);
  for (const f of [1760, 1769]) {
    const o = osc('sine', f);
    vg.connect(o.frequency);
    o.connect(wg);
  }

  let acc = 0, nextBeat = 0, last = -1;
  return {
    update(v, dt) {
      acc += dt;
      if (acc >= 0.08 && Math.abs(v - last) > 0.002) {
        acc = 0; last = v;
        const t = ac.currentTime;
        dg.gain.setTargetAtTime(Math.pow(v, 1.5) * 0.16, t, 0.3);
        lp.frequency.setTargetAtTime(110 + v * 1100, t, 0.3);
        wg.gain.setTargetAtTime(clamp((v - 0.7) / 0.3, 0, 1) * 0.02, t, 0.4);
      }
      // heartbeat scheduler
      if (v > 0.15 && ac.state === 'running') {
        const now = ac.currentTime;
        if (nextBeat < now - 0.2) nextBeat = now + 0.05;
        const bpm = 55 + 95 * clamp((v - 0.15) / 0.85, 0, 1);
        const per = 60 / bpm;
        const vol = 0.18 + 0.7 * v;
        while (nextBeat < now + 0.12) {
          spawn(E, heartRecipe, { at: nextBeat, volume: vol, reverb: 0.05, force: true }, Math.min(0.2, per * 0.3));
          nextBeat += per;
        }
      } else nextBeat = 0;
    },
    dispose() {
      for (const s of srcs) { try { s.stop(); } catch (e) { /* ignore */ } }
      for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    },
  };
}
