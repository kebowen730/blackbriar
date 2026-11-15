// Blackbriar audio: raw WebAudio synthesis, lazy context (created in resume()).
import { initEngine, spawn, clamp } from './synth.js';
import { SFX } from './sfx.js';
import { VOICES } from './voices.js';
import { createAmbience, createTension } from './ambience.js';
import { createLoop, hasLoop } from './loops.js';

const MAX_VOICES = 10;

export function createAudio(ctx) {
  const E = { ac: null, master: null, warned: false };
  let volume = clamp(Number(ctx?.settings?.volume ?? 0.8), 0, 1.5);
  let wantAmb = false;
  let tTarget = 0, tCur = 0;
  let amb = null, tension = null;
  const lastVoice = Object.create(null);

  const dummyLoop = () => ({ setPos() {}, setVolume() {}, stop() {} });

  function updateListener() {
    const cam = ctx?.camera;
    const m = cam?.matrixWorld?.elements;
    if (!m) return;
    const px = m[12], py = m[13], pz = m[14];
    let fx = -m[8], fy = -m[9], fz = -m[10];
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
    const ux = m[4], uy = m[5], uz = m[6];
    E.lx = px; E.ly = py; E.lz = pz;
    const L = E.ac.listener;
    if (L.positionX) {
      L.positionX.value = px; L.positionY.value = py; L.positionZ.value = pz;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz;
      L.upX.value = ux; L.upY.value = uy; L.upZ.value = uz;
    } else {
      L.setPosition(px, py, pz);
      L.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  function setMaster(v) {
    volume = clamp(Number(v) || 0, 0, 1.5);
    if (E.ac) E.master.gain.setTargetAtTime(volume, E.ac.currentTime, 0.05);
  }

  const audio = {
    resume() {
      try {
        if (!E.ac) {
          if (!initEngine(E, volume)) return;
          amb = createAmbience(E);
          tension = createTension(E);
          if (wantAmb) amb.start();
        }
        if (E.ac.state === 'suspended') {
          const p = E.ac.resume();
          if (p && p.catch) p.catch(() => {});
        }
      } catch (e) {
        console.warn('[audio] resume failed', e);
      }
    },

    update(dt) {
      if (!E.ac) return;
      dt = clamp(dt || 0, 0, 0.25);
      try {
        updateListener();
        tCur += (tTarget - tCur) * (1 - Math.exp(-dt * 1.6));
        if (Math.abs(tTarget - tCur) < 0.0005) tCur = tTarget;
        tension?.update(tCur, dt);
        amb?.update(dt);
        if (E.ac.state === 'running') {
          const now = E.ac.currentTime;
          for (const L of E.loops) if (L.tick) L.tick(now, dt);
        }
      } catch (e) {
        if (!E.warned) { E.warned = true; console.warn('[audio] update', e); }
      }
    },

    setMaster,

    setTension(v) { tTarget = clamp(Number(v) || 0, 0, 1); },

    setAmbience(on) {
      wantAmb = !!on;
      if (!amb) return;
      if (wantAmb) amb.start(); else amb.stop();
    },

    play(name, o = {}) {
      if (!E.ac) return;
      const r = SFX[name];
      if (!r) return;
      spawn(E, r.fn, {
        pos: o.pos || null,
        volume: (r.vol ?? 1) * (o.volume ?? 1),
        pitch: o.pitch ?? 1,
        reverb: r.reverb ?? 0,
      });
    },

    creatureVoice(id, kind, pos, o = {}) {
      if (!E.ac || E.ac.state !== 'running') return;
      const v = VOICES[id];
      if (!v) return;
      const fn = v[kind] || v.idle;
      if (typeof fn !== 'function') return;
      const key = id + ':' + kind;
      const now = E.ac.currentTime;
      if (now - (lastVoice[key] ?? -9) < 0.15) return;
      if (E.voices >= MAX_VOICES) return;
      lastVoice[key] = now;
      const s = spawn(E, fn, {
        pos: pos || null,
        volume: (v.gain ?? 1) * (o?.volume ?? 1),
        reverb: v.reverb ?? 0.35,
      });
      if (s) {
        E.voices++;
        const prev = s.onDone;
        s.onDone = () => { E.voices = Math.max(0, E.voices - 1); if (prev) prev(); };
      }
    },

    loop(name, o = {}) {
      if (!E.ac || !hasLoop(name)) return dummyLoop();
      try {
        return createLoop(E, name, o || {});
      } catch (e) {
        if (!E.warned) { E.warned = true; console.warn('[audio] loop', e); }
        return dummyLoop();
      }
    },

    stopAll() {
      wantAmb = false;
      tTarget = 0;
      if (!E.ac) return;
      for (const L of Array.from(E.loops)) { try { L.stopFn?.(); } catch (e) { /* ignore */ } }
      for (const s of Array.from(E.active)) s.kill();
      amb?.stop();
    },
  };

  const onSettings = (e) => {
    if (e && typeof e.volume === 'number') setMaster(e.volume);
  };
  try { ctx?.bus?.on?.('ui:settings', onSettings); } catch (e) { /* ignore */ }

  return audio;
}
