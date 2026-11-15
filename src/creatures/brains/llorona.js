// La Llorona — the weeping woman, bound to water. Her weeping is LOUD when you are far
// and quiet when you are close. Light her for > 1 s, come within 5 m, or land a rock near
// her and the weeping stops dead — then she rushes you at terrifying speed.
// Counter: loud weeping = safe; when it goes quiet, do NOT point your light at the pale
// thing by the water. Break line of sight / hide to make her give up.

import * as THREE from 'three';
import { Creature, clamp, lerp, angleDelta } from '../base.js';

const RING_R = [2, 4, 7, 11];
const RING_N = 8;

export default class Llorona extends Creature {
  init() {
    this.sightRange = 45;
    this.fov = Math.PI * 2;
    this.radius = 0.5;
    this.turnRate = 7;
    this.killRange = 1.5;
    this.state = 'weep';
    const m = this.mem;
    m.home = new THREE.Vector3();
    m.walkTo = null;
    m.nextWalk = 6 + Math.random() * 10;
    m.nextReloc = 60 + Math.random() * 30;
    m.litT = 0;
    m.rock = false;
    m.calmUntil = 0;
    m.noLos = 0;
    m.vol = 0.5;
    m.loop = null;
    m.loopTried = false;
    m.apos = new THREE.Vector3();
  }

  // ---- water helpers ------------------------------------------------------

  /** Distance (m, coarse) from a point to the nearest water, 99 if none nearby. */
  _waterDist(x, z) {
    const w = this.ctx.world;
    if (!w?.isWater) return 99;
    for (let i = 0; i < RING_R.length; i++) {
      const r = RING_R[i];
      for (let k = 0; k < RING_N; k++) {
        const a = (k / RING_N) * Math.PI * 2;
        if (w.isWater(x + Math.sin(a) * r, z + Math.cos(a) * r)) return r;
      }
    }
    return 99;
  }

  /** Best walkable bank point among `tries` samples near `center` (null if no water found). */
  _findBank(center, radius, tries) {
    let best = null;
    let bestD = 99;
    for (let i = 0; i < tries; i++) {
      const pt = this.pickPointNear(center, radius);
      const wd = this._waterDist(pt.x, pt.z);
      if (wd < bestD) {
        bestD = wd;
        best = pt;
        if (wd <= 2) break;
      }
    }
    return best;
  }

  onSpawn() {
    const w = this.ctx.world;
    const half = (w?.half ?? 180) * 0.8;
    const c = new THREE.Vector3();
    let best = null;
    let bestD = 99;
    for (let i = 0; i < 24 && bestD > 2; i++) {
      c.set((Math.random() * 2 - 1) * half, 0, (Math.random() * 2 - 1) * half);
      const pt = this._findBank(c, 40, 3);
      if (!pt) continue;
      const wd = this._waterDist(pt.x, pt.z);
      if (wd < bestD) {
        bestD = wd;
        best = pt;
      }
    }
    if (best) this.teleport(best);
    this.mem.home.copy(this.pos);
  }

  // ---- noise ----------------------------------------------------------------

  onNoise(evt) {
    super.onNoise(evt);
    if (!evt?.pos || evt.source === this) return;
    if ((evt.kind === 'rock' || evt.kind === 'slingshot') && this.distTo(evt.pos) < 6) this.mem.rock = true;
  }

  onAlert() {}

  // ---- audio ----------------------------------------------------------------

  _weepAudio(dt, d, silent, instantSilence) {
    const m = this.mem;
    const audio = this.ctx.audio;
    if (!m.loop && audio?.loop && !m.loopTried) {
      m.loopTried = true;
      try {
        m.loop = audio.loop('weeping', { pos: this.pos, volume: m.vol }) || null;
      } catch (e) {
        m.loop = null;
      }
    }
    if (silent) {
      m.vol = instantSilence ? 0 : Math.max(0, m.vol - dt * 2);
    } else {
      const target = lerp(0.08, 1.0, clamp((d - 8) / 52, 0, 1));
      m.vol += (target - m.vol) * Math.min(1, dt * 1.2);
    }
    if (!m.loop) return;
    const p = this.ctx.player;
    // far: park the sound 6 m from the player in my direction so attenuation doesn't fight the inversion
    if (d > 6 && p) {
      const inv = 6 / (d || 1);
      m.apos.set(p.pos.x + (this.pos.x - p.pos.x) * inv, this.pos.y, p.pos.z + (this.pos.z - p.pos.z) * inv);
      m.loop.setPos?.(m.apos);
    } else {
      m.loop.setPos?.(this.pos);
    }
    m.loop.setVolume?.(m.vol);
  }

  // ---- brain ----------------------------------------------------------------

  think(dt) {
    const m = this.mem;
    const p = this.ctx.player;
    const now = this.ctx.time;
    const d = this.distToPlayer();
    const mul = this.speedMul();

    const grace = this.inGrace() || !p?.alive;
    const calm = now < m.calmUntil;
    let silent = this.state !== 'weep' || calm;
    let instant = false;

    switch (this.state) {
      case 'weep': {
        // --- triggers ---
        if (!grace && !calm) {
          m.litT = this.isLit() ? m.litT + dt : Math.max(0, m.litT - dt * 0.6);
          if (m.litT > 1.0 || (d < 5 && !p.hidden) || m.rock) {
            m.litT = 0;
            m.rock = false;
            this.setState('notice');
            m.walkTo = null;
            silent = true;
            instant = true; // sudden silence
            this.anim = 'special';
            this.stop();
            break;
          }
        } else {
          m.litT = 0;
          m.rock = false;
        }

        // --- relocate toward the player when unobserved and far ---
        if (!grace && !calm && now > m.nextReloc) {
          m.nextReloc = now + 60 + Math.random() * 30;
          if (d > 50 && !this.isObserved()) this._relocate();
        }

        // --- weeping / occasional walk along the bank ---
        if (m.walkTo) {
          this.anim = 'walk';
          if (this.moveToward(m.walkTo, 1.2, dt) < 1 || this.stateTime > 60) {
            m.walkTo = null;
            m.home.copy(this.pos);
            m.nextWalk = now + 8 + Math.random() * 14;
          }
        } else {
          this.anim = 'idle';
          this.stop();
          if (!grace && !calm && now > m.nextWalk) {
            const pt = this._findBank(m.home, 40, 6);
            if (pt) m.walkTo = pt;
            else m.nextWalk = now + 15;
          }
        }
        break;
      }

      case 'notice': {
        this.anim = 'special';
        this.stop();
        this.faceToward(p.pos, dt, 12);
        silent = true;
        instant = true;
        if (this.stateTime >= 0.9) {
          this.setState('rush');
          m.noLos = 0;
          this.voice('special', { minGap: 0 });
          this.startChase();
        }
        break;
      }

      case 'rush': {
        silent = true;
        instant = true;
        const sees = this.canSeePlayer();
        m.noLos = this.hasLineOfSight() ? 0 : m.noLos + dt;
        const hiddenUnseen = p.hidden && now > this.sawHideUntil;
        if (!p.alive || m.noLos >= 4 || hiddenUnseen || this.stateTime >= 14) {
          this.setState('stand');
          this.stop();
          this.anim = 'idle';
          break;
        }
        const tgt = sees || m.noLos < 1.5 ? p.pos : this.lastSeenPos;
        this.anim = d < 4 ? 'attack' : 'run';
        this.moveToward(tgt, 9.5 * mul, dt, { turn: 9 });
        this.voice('chase', { minGap: 3 });
        this.tryKill(1.5);
        break;
      }

      case 'stand': {
        silent = true;
        instant = true;
        this.anim = 'idle';
        this.stop();
        if (this.stateTime >= 3) {
          this.endChase();
          this.setState('return');
          m.calmUntil = now + 15;
        }
        break;
      }

      case 'return': {
        silent = true;
        this.anim = 'walk';
        if (this.moveToward(m.home, 2, dt) < 1.5 || this.stateTime > 45) {
          this.setState('weep');
          m.nextWalk = now + 10 + Math.random() * 10;
        }
        break;
      }

      default:
        this.setState('weep');
    }

    this._weepAudio(dt, d, silent, instant);
  }

  _relocate() {
    const p = this.ctx.player;
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < 14; i++) {
      const pt = this.pickPointNear(p.pos, 70);
      const wd = this._waterDist(pt.x, pt.z);
      if (wd > 7) continue;
      const dp = Math.hypot(pt.x - p.pos.x, pt.z - p.pos.z);
      const score = Math.abs(dp - 38) + wd * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = pt;
      }
    }
    if (best && Math.hypot(best.x - p.pos.x, best.z - p.pos.z) < this.distToPlayer()) {
      this.teleport(best);
      this.mem.home.copy(best);
      this.mem.walkTo = null;
    }
  }

  dispose() {
    try {
      this.mem.loop?.stop?.();
    } catch (e) {
      /* ignore */
    }
    this.mem.loop = null;
    this.endChase();
  }
}
