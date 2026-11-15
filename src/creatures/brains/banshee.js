// Banshee — the alarm. Slow hovering drifter. On sight she winds up (2 s, rising wail),
// then screams: a radius-150 noise that calls every other creature to the player.
// She only kills if you stay inside her wail (< 6 m) for 3 cumulative seconds.
// Counter: break line of sight during the wind-up; outrun her; don't be where she screams.

import * as THREE from 'three';
import { Creature, clamp, lerp, angleDelta } from '../base.js';

const DRIFT_SPEED = 1.8;
const CHASE_SPEED = 3.2;
const WINDUP_TIME = 2.0;
const SCREAM_TIME = 3.0;
const WAIL_RANGE = 6;
const WAIL_KILL_TIME = 3.0;

export default class Banshee extends Creature {
  init() {
    this.sightRange = 24;
    this.fov = 3.0;
    this.hearing = 1;
    this.radius = 0.5;
    this.turnRate = 3.5;
    this.state = 'drift';
    this.mem.lostT = 0;
    this.mem.cdUntil = 0;
    this.mem.near = 0;
    this.mem.screamAt = -99;
    this.mem.voiceAt = 0;
  }

  think(dt) {
    const m = this.mem;
    const p = this.ctx.player;
    const now = this.ctx.time;

    if (this.inGrace() || !p?.alive) {
      if (this.state !== 'drift') this._giveUp(0);
      this._drift(dt);
      return;
    }

    switch (this.state) {
      case 'windup': {
        this.anim = 'idle';
        this.stop();
        this.faceToward(p.pos, dt, 5);
        const seen = this.canSeePlayer() && this.hasLineOfSight();
        m.lostT = seen ? 0 : m.lostT + dt;
        if (m.lostT > 0.5) {
          // lost interest — drifts on
          m.cdUntil = now + 6;
          this.setState('drift');
          break;
        }
        // rising wail
        if (now - m.voiceAt > 0.6) {
          m.voiceAt = now;
          this.voice('alert', { volume: 0.35 + 0.65 * clamp(this.stateTime / WINDUP_TIME, 0, 1), minGap: 0 });
        }
        if (this.stateTime >= WINDUP_TIME) this._scream();
        break;
      }
      case 'scream': {
        this.anim = 'special';
        this._approach(dt);
        this._wailKill(dt);
        if (this.state === 'scream' && this.stateTime >= SCREAM_TIME) {
          this.setState('pursue');
          m.lostSeen = now;
        }
        break;
      }
      case 'pursue': {
        const sees = this.canSeePlayer();
        this.anim = 'walk';
        this._approach(dt);
        this._wailKill(dt);
        if (this.state !== 'pursue') break;
        if (sees && now - m.screamAt > 10) {
          this._scream();
          break;
        }
        if (this.stateTime >= 8 && this.timeSinceSeen() > 6) this._giveUp(20);
        break;
      }
      default: {
        // drift — look for the player
        if (now >= m.cdUntil && this.canSeePlayer()) {
          this.setState('windup');
          m.lostT = 0;
          m.voiceAt = 0;
          break;
        }
        this._drift(dt);
      }
    }
  }

  _scream() {
    const m = this.mem;
    const p = this.ctx.player;
    this.setState('scream');
    m.screamAt = this.ctx.time;
    this.voice('special', { minGap: 0 });
    this.ctx.bus.emit('noise', { pos: p.pos.clone(), radius: 150, kind: 'scream', source: this });
    this.ctx.creatures?.alertAll(p.pos, this);
    this.ctx.fx?.pulse?.(0.6);
    this.startChase();
  }

  _giveUp(cooldown) {
    const m = this.mem;
    this.endChase();
    m.near = 0;
    m.cdUntil = this.ctx.time + cooldown;
    this.setState('drift');
  }

  _approach(dt) {
    const p = this.ctx.player;
    const tgt = this.timeSinceSeen() < 1.5 || this.state === 'scream' ? p.pos : this.lastSeenPos;
    if (this.distTo(tgt) > 1.5) this.moveToward(tgt, CHASE_SPEED * this.speedMul(), dt);
    else {
      this.stop();
      this.faceToward(p.pos, dt);
    }
  }

  _wailKill(dt) {
    const m = this.mem;
    if (this.distToPlayer() < WAIL_RANGE) m.near += dt;
    if (m.near >= WAIL_KILL_TIME) {
      if (!this.tryKill(WAIL_RANGE + 4)) m.near = WAIL_KILL_TIME - 0.1; // hidden & unseen: retry later
    }
  }

  _drift(dt) {
    const m = this.mem;
    this.anim = 'walk';
    // rocks / alerts: turn toward the noise and drift to it
    const h = this.heard(10);
    if (h && this.distTo(h.pos) > 3) {
      this.moveToward(h.pos, DRIFT_SPEED, dt);
      return;
    }
    if (h) this.lastHeard = null;
    this.wander(dt, DRIFT_SPEED, { radius: 70 });
  }
}
