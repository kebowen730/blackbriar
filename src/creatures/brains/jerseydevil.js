// JERSEY DEVIL — charger. Screeches, locks a heading, then rushes in a straight line it cannot
// steer. Trees stop it dead (stun). Counter: sidestep late, keep trunks between you.

import { Creature, clamp, lerp } from '../base.js';
import * as THREE from 'three';

export default class JerseyDevil extends Creature {
  init() {
    this.radius = 0.7;
    this.sightRange = 30;
    this.fov = 2.8;
    this.hearing = 1;
    this.turnRate = 3;
    this.killRange = 1.7;
    this.state = 'roam';
    const m = this.mem;
    m.target = new THREE.Vector3();
    m.targetIsPlayer = true;
    m.chargeYaw = 0;
    m.chargeStart = new THREE.Vector3();
    m.lastNoise = -1;
    m.nextIdle = 10 + Math.random() * 10;
  }

  _senses() {
    // returns true if the player is within 40 m and seen / heard
    if (this.inGrace()) return false;
    if (this.distToPlayer() > 40) return false;
    return this.canSeePlayer() || this.canHearPlayer(1.3);
  }

  _telegraph(pos, isPlayer) {
    const m = this.mem;
    m.target.copy(pos);
    m.targetIsPlayer = isPlayer;
    this.setState('telegraph');
    if (isPlayer) this.startChase(); // a rock charge is not a hunt: no stinger, no tension
    this.voice('special', { minGap: 0 });
  }

  think(dt) {
    const m = this.mem;
    const ctx = this.ctx;
    const p = ctx.player;
    const mul = this.speedMul();

    switch (this.state) {
      case 'telegraph': {
        this.anim = 'special';
        this.stop();
        const t = m.targetIsPlayer ? p.pos : m.target;
        this.faceToward(t, dt, 6);
        if (this.stateTime >= 1.4) {
          // lock heading now — no leading, no tracking afterwards
          m.chargeYaw = Math.atan2(t.x - this.pos.x, t.z - this.pos.z);
          m.chargeStart.copy(this.pos);
          this.yaw = m.chargeYaw;
          this.setState('charge');
        }
        break;
      }

      case 'charge': {
        this.anim = 'run';
        const blocked = this.moveStraight(m.chargeYaw, 16 * mul, dt);
        if (this.tryKill(1.7)) return;
        const travelled = Math.hypot(this.pos.x - m.chargeStart.x, this.pos.z - m.chargeStart.z);
        if (blocked && this.stateTime > 0.2) {
          this.stop();
          this.setState('stunned');
          this.voice('alert', { minGap: 0 });
        } else if (this.stateTime > 2.6 || travelled > 45) {
          this.setState('recover');
        }
        break;
      }

      case 'stunned': {
        this.anim = 'idle';
        this.stop();
        if (this.stateTime >= 3.5) this.setState('recover');
        break;
      }

      case 'recover': {
        this.anim = 'walk';
        if (this.stateTime < 0.8) {
          // overshoot, skidding to a halt
          this.moveStraight(m.chargeYaw, lerp(8, 1.5, this.stateTime / 0.8), dt);
          this.tryKill(1.7);
        } else {
          this.stop();
          this.faceToward(p.pos, dt, 1.6);
        }
        if (this.stateTime >= 2) {
          if (this._senses()) this._telegraph(p.pos, true);
          else {
            this.endChase();
            this.setState('roam');
          }
        }
        break;
      }

      default: {
        // roam
        if (this.state !== 'roam') this.setState('roam');
        this.anim = 'walk';
        this.wander(dt, 3.5, { radius: 70 });
        if (!this.inGrace()) {
          if (this._senses()) {
            this._telegraph(p.pos, true);
            break;
          }
          const h = this.heard(6);
          if (h && h.time !== m.lastNoise) {
            m.lastNoise = h.time;
            if (this.distTo(h.pos) < 90) {
              this._telegraph(h.pos, false);
              break;
            }
          }
        }
        if (ctx.time > m.nextIdle) {
          m.nextIdle = ctx.time + 10 + Math.random() * 15;
          this.voice('idle');
        }
        break;
      }
    }
  }
}
