// Nightcrawler — blind, hunts purely by sound. NEVER uses canSeePlayer.
// Counter: freeze, crouch (crouch-walking is treated as silent), throw rocks.

import * as THREE from 'three';
import { Creature, clamp, lerp, angleDelta } from '../base.js';

const DRIFT_SPEED = 1.5;
const HOME_SPEED = 5.6;
const NOTICE_TIME = 0.5;
const HOLD_TIME = 5;
const OVERRIDE_TIME = 10;

export default class Nightcrawler extends Creature {
  init() {
    this.hearing = 3.0;
    this.sightRange = 0;
    this.killRange = 1.3;
    this.radius = 0.6;
    this.turnRate = 6;
    this.mem.target = new THREE.Vector3();
    this.mem.ovPos = new THREE.Vector3();
    this.mem.ovUntil = -1;
    this.mem.ovNew = false;
    this.mem.nextPause = 6 + Math.random() * 8;
    this.mem.bestRem = Infinity;
    this.mem.noProg = 0;
    this.mem.pauseUntil = 0;
    this.state = 'drift';
  }

  onNoise(evt) {
    if (!evt?.pos || evt.source === this) return;
    if (this.distTo(evt.pos) > (evt.radius || 0) * this.hearing) return;
    super.onNoise(evt);
    const m = this.mem;
    m.ovPos.copy(evt.pos);
    m.ovUntil = this.ctx.time + OVERRIDE_TIME;
    m.ovNew = true;
  }

  onAlert(pos) {
    // blind: ignore creature alerts unless they are loud noises (handled by onNoise)
  }

  think(dt) {
    const m = this.mem;
    const p = this.ctx.player;
    const now = this.ctx.time;

    if (this.inGrace() || !p?.alive) {
      this._drift(dt);
      return;
    }

    const ov = now < m.ovUntil;
    const hears = (p.noiseRadius || 0) > 4 && this.canHearPlayer();

    // --- new stimuli ------------------------------------------------------
    if (ov && m.ovNew) {
      m.ovNew = false;
      m.target.copy(m.ovPos);
      m.bestRem = Infinity;
      m.noProg = 0;
      if (this.state === 'drift' || this.state === 'hold') this._startNotice();
      else if (this.state === 'notice') {
        /* target already updated */
      } else if (this.state !== 'home') this.setState('home');
    } else if (!ov && hears) {
      m.target.copy(p.pos);
      if (this.state === 'drift' || this.state === 'hold') this._startNotice();
    }

    switch (this.state) {
      case 'notice': {
        this.anim = 'special';
        this.stop();
        this.faceToward(m.target, dt, 8);
        if (this.stateTime >= NOTICE_TIME) {
          m.bestRem = Infinity;
          m.noProg = 0;
          this.setState('home');
        }
        break;
      }
      case 'home': {
        if (!ov && hears) m.target.copy(p.pos); // keep re-targeting while the sound lasts
        this.anim = 'run';
        const rem = this.moveToward(m.target, HOME_SPEED * this.speedMul(), dt, { turn: 8 });
        if (rem < m.bestRem - 0.15) {
          m.bestRem = rem;
          m.noProg = 0;
        } else m.noProg += dt;
        // arrived, blocked for ~1 s (stone / rock outside the map), or homing too long with nothing to hear
        if ((rem < 2.2 && (ov || !hears)) || (m.noProg > 1 && (ov || !hears)) || (this.stateTime > 12 && !hears)) {
          this.setState('hold');
          this.stop();
        }
        break;
      }
      case 'hold': {
        this.anim = 'idle';
        this.stop();
        if (this.stateTime >= HOLD_TIME) {
          this.endChase();
          this.setState('drift');
        }
        break;
      }
      default:
        this._drift(dt);
    }

    // contact kill: only a completely still, crouched player is passed by
    if (this.state !== 'drift' || this.distToPlayer() < 3) {
      if (!(p.speed < 0.2 && p.isCrouching)) this.tryKill(1.3);
    }
  }

  _startNotice() {
    this.setState('notice');
    this.startChase();
    this.voice('alert', { minGap: 3 });
  }

  _drift(dt) {
    const m = this.mem;
    const now = this.ctx.time;
    if (this.state !== 'drift') this.setState('drift');
    if (now < m.pauseUntil) {
      this.anim = 'idle';
      this.stop();
      return;
    }
    if (now > m.nextPause) {
      m.pauseUntil = now + 2 + Math.random() * 3.5;
      m.nextPause = now + 8 + Math.random() * 12;
      return;
    }
    this.anim = 'walk';
    this.wander(dt, DRIFT_SPEED, { radius: 50 });
  }

  dispose() {
    this.endChase();
  }
}
