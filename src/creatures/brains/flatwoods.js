// Flatwoods — the drainer. Slow, inexorable, never distracted. Its aura drains the
// flashlight battery and forces flicker; lingering in its gas (< 4 m, 2.5 s) kills.
// Counter: keep moving; don't dawdle at wardstones when your light starts dying.

import * as THREE from 'three';
import { Creature, clamp, lerp, angleDelta } from '../base.js';

const SPEED = 2.3;
const AURA_RANGE = 22;
const GAS_RANGE = 4;
const GAS_KILL = 2.5;

export default class Flatwoods extends Creature {
  init() {
    this.altitude = 0; // the model has its hover offset built in
    this.sightRange = 30;
    this.fov = Math.PI * 2;
    this.radius = 0.7;
    this.turnRate = 2.2;
    this.killRange = 6;
    this.state = 'seek';
    const m = this.mem;
    m.target = new THREE.Vector3();
    m.hasTarget = false;
    m.sampleT = 99; // sample immediately
    m.auraT = 0;
    m.gas = 0;
    m.loop = null;
    m.loopTried = false;
    m.draining = false;
  }

  onSpawn() {
    this.mem.target.copy(this.pos);
  }

  // never distracted
  onNoise() {}
  onAlert() {}

  think(dt) {
    const m = this.mem;
    const p = this.ctx.player;
    const mul = this.speedMul();
    const d = this.distToPlayer();

    this._hum(d, dt);

    if (!p?.alive) {
      this._restore();
      this.anim = 'idle';
      this.stop();
      return;
    }

    if (this.inGrace()) {
      this._restore();
      this.anim = 'walk';
      this.wander(dt, SPEED * 0.6 * mul, { radius: 30 });
      return;
    }

    const los = this.hasLineOfSight();

    // --- sense: alien awareness of roughly where the player is ------------
    m.sampleT += dt;
    if (m.sampleT >= 4 || !m.hasTarget) {
      const hiddenFar = p.hidden && !(d < 12 && los);
      if (!hiddenFar || !m.hasTarget) {
        m.sampleT = 0;
        let err = d > 60 ? 25 : 8;
        if (d < 30 && los) err = 0;
        const a = Math.random() * Math.PI * 2;
        const r = err * Math.sqrt(Math.random());
        m.target.set(p.pos.x + Math.sin(a) * r, 0, p.pos.z + Math.cos(a) * r);
        m.hasTarget = true;
      } else {
        m.sampleT = 2; // hidden: keep the stale point, re-check soon
      }
    }

    // --- glide ------------------------------------------------------------
    if (this.distTo(m.target) > 1.5) {
      this.anim = 'walk';
      this.moveToward(m.target, SPEED * mul, dt);
    } else {
      this.anim = 'idle'; // lingering at the last sampled point
      this.stop();
      this.faceToward(p.pos, dt, 1);
    }

    // --- chase flag -------------------------------------------------------
    if (d < 18) this.startChase();
    else if (d > 30) this.endChase();

    // --- aura -------------------------------------------------------------
    const fl = p.flashlight;
    if (fl && los && d < AURA_RANGE) {
      const close = 1 - d / AURA_RANGE;
      fl.drainMultiplier = lerp(1, 7, close);
      m.draining = true;
      m.auraT -= dt;
      if (m.auraT <= 0) {
        fl.forceFlicker?.(0.4);
        m.auraT = lerp(3, 1.5, close) * (0.8 + Math.random() * 0.4);
      }
    } else {
      this._restore();
      m.auraT = Math.min(m.auraT, 1);
    }

    // --- gas --------------------------------------------------------------
    if (d < GAS_RANGE) m.gas += dt;
    else m.gas = Math.max(0, m.gas - dt * 0.5);
    if (m.gas >= GAS_KILL) {
      if (!this.tryKill(6)) m.gas = GAS_KILL - 0.05; // hidden & unseen: retry
    }
  }

  _restore() {
    const fl = this.ctx.player?.flashlight;
    if (fl && this.mem.draining) fl.drainMultiplier = 1;
    this.mem.draining = false;
  }

  _hum(d, dt) {
    const m = this.mem;
    const audio = this.ctx.audio;
    if (!m.loop && audio?.loop && !m.loopTried) {
      m.loopTried = true;
      try {
        m.loop = audio.loop('hum', { pos: this.pos, volume: 0 }) || null;
      } catch (e) {
        m.loop = null;
      }
    }
    if (m.loop) {
      m.loop.setPos?.(this.pos);
      m.loop.setVolume?.(lerp(0.12, 1, clamp(1 - d / 70, 0, 1)));
    }
  }

  dispose() {
    this._restore();
    const fl = this.ctx.player?.flashlight;
    if (fl) fl.drainMultiplier = 1;
    try {
      this.mem.loop?.stop?.();
    } catch (e) {
      /* ignore */
    }
    this.mem.loop = null;
    this.endChase();
  }
}
