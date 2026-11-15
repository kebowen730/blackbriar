// MOTHMAN — aerial hunter. Drawn to the flashlight from far away, circles high overhead,
// and dives when the light stays on in the open. Counter: light off + move, or thick canopy.

import { Creature, clamp, lerp, angleDelta } from '../base.js';
import * as THREE from 'three';

const TAU = Math.PI * 2;

export default class Mothman extends Creature {
  init() {
    this.radius = 0.8;
    this.sightRange = 90;
    this.fov = TAU;
    this.hearing = 0; // rocks / noises never matter
    this.killRange = 1.8;
    this.turnRate = 2.2;
    this.altitude = 16;
    this.state = 'roam';
    const m = this.mem;
    m.attention = 0; // 0..100
    m.noticed = false;
    m.lostT = 0;
    m.dir = Math.random() < 0.5 ? 1 : -1;
    m.aim = new THREE.Vector3();
    m.startAlt = 16;
    m.startDist = 10;
    m.swoopStarted = false;
    m.loop = null;
    m.loopTried = false;
    m.nextIdle = 8 + Math.random() * 10;
  }

  onNoise() {}
  onAlert() {}

  _approachAlt(target, rate, dt) {
    this.altitude = lerp(this.altitude, target, 1 - Math.exp(-rate * dt));
  }

  _miss() {
    const m = this.mem;
    m.attention = 30;
    this.endChase();
    m.swoopStarted = false;
    m.dir = -m.dir;
    this.setState('recover');
  }

  think(dt) {
    const m = this.mem;
    const ctx = this.ctx;
    const p = ctx.player;
    const w = ctx.world;
    const now = ctx.time;
    const dist = this.distToPlayer();
    const grace = this.inGrace();
    const mul = this.speedMul();

    // --- wing loop: closer = louder ---
    if (!m.loop && !m.loopTried && ctx.audio?.loop) {
      m.loopTried = true;
      try {
        m.loop = ctx.audio.loop('wings', { pos: this.pos, volume: 0.3 });
      } catch (e) {
        m.loop = null;
      }
    }
    if (m.loop) {
      m.loop.setPos?.(this.pos);
      m.loop.setVolume?.(clamp(1.1 - dist / 90, 0.04, 1) * (this.state === 'dive' ? 1.2 : 0.8));
    }

    // --- attention ---
    const canopy = w?.canopyAt?.(p.pos.x, p.pos.z) ?? 0;
    const lightOn = !!p.flashlight?.on && p.alive;
    if (grace) {
      m.attention = 0;
      m.noticed = false;
    } else if (this.state !== 'dive' && this.state !== 'recover') {
      if (lightOn && dist < 90) m.noticed = true;
      const exposed = lightOn && dist < 90 && !p.hidden && canopy <= 0.6;
      if (exposed) m.attention = Math.min(100, m.attention + (10 + 14 * (1 - canopy)) * dt);
      else m.attention = Math.max(0, m.attention - (lightOn ? 8 : 14) * dt);
      if (m.noticed && m.attention <= 0 && !lightOn) {
        m.lostT += dt;
        if (m.lostT > 12) {
          m.noticed = false;
          m.lostT = 0;
        }
      } else m.lostT = 0;
    }

    this.anim = 'fly';
    const bob = Math.sin(this.t * 0.6) * 1.2;

    switch (this.state) {
      case 'circle': {
        if (!m.noticed || grace) {
          this.setState('roam');
          break;
        }
        this._approachAlt(16 + bob, 1.2, dt);
        if (dist > 45) this.moveToward(p.pos, 16, dt, { fly: true, turn: 3 });
        else this.orbit(p.pos, 26, 7, dt, m.dir, { fly: true, turn: 3 });
        if (m.attention >= 100 && dist < 55 && p.alive) {
          this.setState('dive');
          m.swoopStarted = false;
          m.aim.copy(p.pos);
          this.voice('alert', { minGap: 0 });
          this.startChase();
        }
        break;
      }

      case 'dive': {
        // aim follows the player while the light is on, freezes when it goes off
        if (lightOn) m.aim.copy(p.pos);
        const aimDist = Math.hypot(p.pos.x - m.aim.x, p.pos.z - m.aim.z);
        if ((!lightOn && aimDist > 4) || canopy > 0.6 || !p.alive) {
          this._miss();
          break;
        }
        if (this.stateTime < 1.2) {
          // telegraph: hover, wings spread, facing the victim
          this.anim = 'fly';
          this._approachAlt(Math.max(this.altitude, 14) + bob * 0.2, 2, dt);
          this.stop();
          this.faceToward(p.pos, dt, 4);
          break;
        }
        this.anim = 'attack';
        const rem = this.distTo(m.aim);
        if (!m.swoopStarted) {
          m.swoopStarted = true;
          m.startAlt = this.altitude;
          m.startDist = Math.max(rem, 8);
        }
        const target = 0.2 + (m.startAlt - 0.2) * clamp((rem - 3) / (m.startDist - 3), 0, 1);
        this.altitude = lerp(this.altitude, target, Math.min(1, dt * 8));
        const want = Math.atan2(m.aim.x - this.pos.x, m.aim.z - this.pos.z);
        this.yaw += clamp(angleDelta(this.yaw, want), -2.6 * dt, 2.6 * dt);
        this.moveStraight(this.yaw, 15 * mul, dt, { fly: true });
        if (this.altitude < 2.2 && this.tryKill(1.8)) return;
        if (rem < 1.0 || this.stateTime > 6.5) this._miss();
        break;
      }

      case 'recover': {
        this.anim = 'fly';
        this._approachAlt(16 + bob, 1.1, dt);
        this.moveStraight(this.yaw, 9, dt, { fly: true });
        if (this.stateTime > 3) this.setState(m.noticed ? 'circle' : 'roam');
        break;
      }

      default: {
        // roam
        if (this.state !== 'roam') this.setState('roam');
        this._approachAlt(18 + bob, 0.8, dt);
        this.wander(dt, 7, { radius: 120, fly: true, turn: 2.5 });
        if (m.noticed && !grace) this.setState('circle');
        break;
      }
    }

    if (this.state !== 'dive' && now > m.nextIdle && dist < 80) {
      m.nextIdle = now + 10 + Math.random() * 15;
      this.voice('idle', { volume: 0.7 });
    }
  }

  dispose() {
    try {
      this.mem.loop?.stop?.();
    } catch (e) {
      /* ignore */
    }
    this.mem.loop = null;
  }
}
