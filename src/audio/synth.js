// Core WebAudio synthesis helpers for Blackbriar: engine, node rigs, one-shot "Shot", formant voice.
// No audio files, no libraries.

export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Vowel formants (F1, F2, F3)
export const VOW = {
  a: [800, 1150, 2900],
  ah: [700, 1220, 2600],
  o: [450, 800, 2830],
  u: [325, 700, 2530],
  e: [400, 2000, 2800],
  i: [270, 2140, 2950],
  ae: [660, 1720, 2410],
};

/** [[t,'a'],[t,'o']] -> three keypoint arrays (one per formant). */
export function seq(list) {
  return [0, 1, 2].map((i) => list.map(([t, v]) => [t, (typeof v === 'string' ? VOW[v] : v)[i]]));
}

/** Apply keypoints [[dt,value],...] to an AudioParam starting at time t. */
export function keys(p, t, k, exp = true) {
  p.setValueAtTime(k[0][1], t + k[0][0]);
  for (let i = 1; i < k.length; i++) {
    const [dt, v] = k[i];
    if (exp && v > 0 && k[i - 1][1] > 0) p.exponentialRampToValueAtTime(v, t + dt);
    else p.linearRampToValueAtTime(v, t + dt);
  }
}

/** Attack/decay envelope that settles to ~0 by t+dur. */
export function env(p, t, vol, att, dur) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(vol, t + att);
  p.setTargetAtTime(0, t + att, Math.max(0.004, (dur - att) / 6));
}

const curveCache = new Map();
export function distCurve(k = 30) {
  let c = curveCache.get(k);
  if (c) return c;
  const n = 1024;
  c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  curveCache.set(k, c);
  return c;
}

export function makeNoise(ac, seconds, color) {
  const n = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  if (color === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else if (color === 'brown') {
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  } else {
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** Dark forest-ish reverb impulse: decaying noise whose high end dies faster. */
export function makeImpulse(ac, seconds = 1.8) {
  const sr = ac.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ac.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const a = 0.5 * (1 - t) + 0.05 * t; // one-pole lowpass coef: tail gets darker
      const pre = i < sr * 0.01 ? i / (sr * 0.01) : 1;
      const x = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * pre;
      y += a * (x - y);
      d[i] = y * 2.2;
    }
  }
  return buf;
}

export function setPannerPos(p, pos, ac, tc = 0) {
  if (!pos) return;
  const x = pos.x || 0, y = pos.y || 0, z = pos.z || 0;
  if (p.positionX) {
    if (tc > 0 && ac) {
      const t = ac.currentTime;
      p.positionX.setTargetAtTime(x, t, tc);
      p.positionY.setTargetAtTime(y, t, tc);
      p.positionZ.setTargetAtTime(z, t, tc);
    } else {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    }
  } else if (p.setPosition) p.setPosition(x, y, z);
}

export function makePanner(E, pos) {
  const p = E.ac.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = 3;
  p.rolloffFactor = 1.4;
  p.maxDistance = 120;
  setPannerPos(p, pos, E.ac, 0);
  return p;
}

/** Create the AudioContext and the master chain. Returns false when unavailable. */
export function initEngine(E, volume) {
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  if (!AC) return false;
  let ac;
  try {
    ac = new AC({ latencyHint: 'interactive' });
  } catch (e) {
    try { ac = new AC(); } catch (e2) { return false; }
  }
  E.ac = ac;
  E.master = ac.createGain();
  E.master.gain.value = volume;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 20;
  comp.ratio.value = 5;
  comp.attack.value = 0.004;
  comp.release.value = 0.25;
  E.master.connect(comp);
  comp.connect(ac.destination);
  E.comp = comp;

  // shared reverb send
  E.reverbIn = ac.createGain();
  const conv = ac.createConvolver();
  conv.buffer = makeImpulse(ac, 1.8);
  const rlp = ac.createBiquadFilter();
  rlp.type = 'lowpass';
  rlp.frequency.value = 3600;
  const rout = ac.createGain();
  rout.gain.value = 0.9;
  E.reverbIn.connect(conv);
  conv.connect(rlp);
  rlp.connect(rout);
  rout.connect(E.master);

  E.noise = { white: makeNoise(ac, 2, 'white'), pink: makeNoise(ac, 4, 'pink'), brown: makeNoise(ac, 4, 'brown') };
  E.active = new Set();
  E.loops = new Set();
  E.voices = 0;
  E.lx = 0; E.ly = 0; E.lz = 0;
  E.distTo = (p) => Math.hypot((p.x || 0) - E.lx, (p.y || 0) - E.ly, (p.z || 0) - E.lz);
  E.ringPos = (minR, maxR) => {
    const a = Math.random() * Math.PI * 2, r = rnd(minR, maxR);
    return { x: E.lx + Math.cos(a) * r, y: E.ly + rnd(-1, 3), z: E.lz + Math.sin(a) * r };
  };
  return true;
}

/** Base for node bookkeeping. */
export class Rig {
  constructor(E) {
    this.E = E;
    this.ac = E.ac;
    this.nodes = [];
    this.srcs = [];
  }
  n(x) { this.nodes.push(x); return x; }
  g(v = 1) { const x = this.n(this.ac.createGain()); x.gain.value = v; return x; }
  f(type, freq, q = 1) {
    const x = this.n(this.ac.createBiquadFilter());
    x.type = type; x.frequency.value = freq; x.Q.value = q;
    return x;
  }
  shaper(k = 20) { const x = this.n(this.ac.createWaveShaper()); x.curve = distCurve(k); return x; }
  chain(...a) { for (let i = 0; i < a.length - 1; i++) a[i].connect(a[i + 1]); return a[a.length - 1]; }
  loopOsc(type, f) {
    const o = this.ac.createOscillator();
    o.type = type; o.frequency.value = f; o.start();
    this.srcs.push(o); this.nodes.push(o);
    return o;
  }
  loopNoise(color = 'white') {
    const b = this.ac.createBufferSource();
    b.buffer = this.E.noise[color]; b.loop = true;
    b.start(0, Math.random() * b.buffer.duration);
    this.srcs.push(b); this.nodes.push(b);
    return b;
  }
  dispose() {
    for (const s of this.srcs) { try { s.stop(); } catch (e) { /* already stopped */ } }
    for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    this.srcs.length = 0;
    this.nodes.length = 0;
  }
}

/** A single one-shot sound: routed (optionally positional), self-cleaning. */
export class Shot extends Rig {
  constructor(E, o = {}) {
    super(E);
    const ac = this.ac;
    this.t0 = o.at ?? ac.currentTime + 0.015;
    this.end = this.t0;
    this.pending = 0;
    this.dead = false;
    this.vol = o.volume ?? 1;
    this.pitch = o.pitch ?? 1;
    this.onDone = null;
    this.out = this.g(this.vol);
    let tail = this.out;
    if (o.pos) {
      const d = E.distTo(o.pos);
      const lp = this.f('lowpass', clamp(18000 / (1 + d * 0.05), 1800, 18000), 0.5);
      const p = this.n(makePanner(E, o.pos));
      tail.connect(lp);
      lp.connect(p);
      tail = p;
    }
    tail.connect(E.master);
    const rv = o.reverb ?? 0;
    if (rv > 0) {
      const sg = this.g(rv);
      tail.connect(sg);
      sg.connect(E.reverbIn);
    }
  }
  track(o, t1) {
    this.pending++;
    this.srcs.push(o);
    if (t1 > this.end) this.end = t1;
    o.onended = () => { if (--this.pending <= 0) this.cleanup(); };
  }
  osc(type, freq, t0, t1) {
    const o = this.n(this.ac.createOscillator());
    o.type = type;
    o.frequency.value = freq;
    if (t1 < t0 + 0.01) t1 = t0 + 0.01;
    o.start(t0); o.stop(t1);
    this.track(o, t1);
    return o;
  }
  noise(t0, t1, color = 'white') {
    const b = this.n(this.ac.createBufferSource());
    b.buffer = this.E.noise[color];
    b.loop = true;
    if (t1 < t0 + 0.01) t1 = t0 + 0.01;
    b.start(t0, Math.random() * b.buffer.duration);
    b.stop(t1);
    this.track(b, t1);
    return b;
  }
  /** pitched tone with optional glide, FM and filter. Returns output gain. */
  tone(o) {
    const t = o.t ?? this.t0, dur = o.dur ?? 0.3, f = o.f ?? 440;
    const t1 = t + dur + 0.02;
    const osc = this.osc(o.type || 'sine', f, t, t1);
    if (o.f2) {
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide ?? dur));
    }
    if (o.fmRate) {
      const l = this.osc('sine', o.fmRate, t, t1);
      const lg = this.g(o.fmDepth ?? 50);
      l.connect(lg); lg.connect(osc.frequency);
    }
    const g = this.g(0);
    env(g.gain, t, o.vol ?? 1, o.att ?? 0.004, dur);
    let src = osc;
    if (o.filt) { const fl = this.f(o.filt[0], o.filt[1], o.filt[2] ?? 1); osc.connect(fl); src = fl; }
    src.connect(g);
    g.connect(o.to || this.out);
    return g;
  }
  /** filtered noise burst with envelope. Returns output gain. */
  burst(o) {
    const t = o.t ?? this.t0, dur = o.dur ?? 0.1;
    const n = this.noise(t, t + dur + 0.02, o.color || 'white');
    const fl = this.f(o.type || 'bandpass', o.f ?? 2000, o.q ?? 1);
    if (o.f2) {
      fl.frequency.setValueAtTime(o.f, t);
      fl.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    }
    const g = this.g(0);
    env(g.gain, t, o.vol ?? 1, o.att ?? 0.002, dur);
    n.connect(fl); fl.connect(g); g.connect(o.to || this.out);
    return g;
  }
  seal() {
    const e = Math.max(this.end, this.t0 + 0.05);
    this.out.gain.setValueAtTime(this.vol, Math.max(this.t0, e - 0.05));
    this.out.gain.linearRampToValueAtTime(0, e);
  }
  kill() {
    if (this.dead) return;
    const t = this.ac.currentTime;
    try {
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setTargetAtTime(0, t, 0.02);
      for (const s of this.srcs) { try { s.stop(t + 0.12); } catch (e) { /* ignore */ } }
    } catch (e) { this.cleanup(); }
  }
  cleanup() {
    if (this.dead) return;
    this.dead = true;
    this.dispose();
    this.E.active.delete(this);
    if (this.onDone) { const f = this.onDone; this.onDone = null; f(); }
  }
}

/** Build + play a one-shot recipe. Returns the Shot or null. */
export function spawn(E, recipe, o = {}, arg) {
  if (!E.ac || E.ac.state !== 'running') return null;
  if (!o.force && E.active.size >= 56) return null;
  let s;
  try {
    s = new Shot(E, o);
    recipe(s, arg);
    s.seal();
  } catch (e) {
    if (!E.warned) { E.warned = true; console.warn('[audio]', e); }
    if (s) s.cleanup();
    return null;
  }
  if (s.pending === 0) { s.cleanup(); return null; }
  E.active.add(s);
  return s;
}

/**
 * Formant voice: saw source (+detuned twin) -> parallel bandpass bank -> optional AM / distortion -> amp env.
 * o: { t, dur, f0:[[dt,hz]], vow:[[dt,'a']], amp:[[dt,0..1]], vib(cents), vibRate, jitter(cents), breath,
 *      thick(ratio), q:[..], gains:[..], dist, am:[rate,depth], vol, fs, wave, to }
 */
export function formant(s, o) {
  const t = o.t ?? s.t0, dur = o.dur;
  const t1 = t + dur + 0.05;
  const f0 = o.f0 || [[0, 200]];
  const sum = s.g(o.makeup ?? 3);
  const src = s.g(1);
  const mk = (ratio) => {
    const os = s.osc(o.wave || 'sawtooth', f0[0][1] * ratio, t, t1);
    keys(os.frequency, t, f0.map(([a, b]) => [a, b * ratio]));
    if (o.vib) {
      const l = s.osc('sine', o.vibRate || 5.5, t, t1);
      const lg = s.g(o.vib);
      l.connect(lg); lg.connect(os.detune);
    }
    if (o.jitter) {
      const l = s.osc('sine', rnd(27, 37), t, t1);
      const lg = s.g(o.jitter);
      l.connect(lg); lg.connect(os.detune);
    }
    os.connect(src);
  };
  mk(1);
  if (o.thick) mk(o.thick);
  if (o.breath) {
    const n = s.noise(t, t1, 'white');
    const ng = s.g(o.breath);
    n.connect(ng); ng.connect(src);
  }
  const fk = seq(o.vow || [[0, 'a']]);
  const q = o.q || [10, 12, 14];
  const gn = o.gains || [1, 0.6, 0.3];
  for (let i = 0; i < 3; i++) {
    const b = s.f('bandpass', fk[i][0][1] * (o.fs || 1), q[i]);
    keys(b.frequency, t, fk[i].map(([a, v]) => [a, v * (o.fs || 1)]));
    const bg = s.g(gn[i]);
    src.connect(b); b.connect(bg); bg.connect(sum);
  }
  let tail = sum;
  if (o.am) {
    const ag = s.g(1 - o.am[1] / 2);
    const l = s.osc('sine', o.am[0], t, t1);
    const lg = s.g(o.am[1] / 2);
    l.connect(lg); lg.connect(ag.gain);
    tail.connect(ag); tail = ag;
  }
  if (o.dist) {
    const sh = s.shaper(o.dist * 5);
    tail.connect(sh); tail = sh;
  }
  const a = s.g(0);
  keys(a.gain, t, (o.amp || [[0, 0], [0.05, 1], [dur - 0.1, 1], [dur, 0]]).map(([x, v]) => [x, v * (o.vol ?? 1)]), false);
  tail.connect(a);
  a.connect(o.to || s.out);
  return a;
}
