// DOGMAN — pursuit predator. Patrols widely, hears sprinting from far, runs faster than you,
// but is dumb: gives up fast, and any rock noise yanks it away.
// States: patrol | hunt | sniff (search at last known) | investigate (noise)
import * as THREE from 'three';
import { Creature, clamp, lerp, angleDelta } from '../base.js';

export default class Dogman extends Creature {
  init() {
    this.sightRange = 26;
    this.fov = 2.6;
    this.hearing = 2.2;
    this.killRange = 1.7;
    this.radius = 0.55;
    this.turnRate = 7;
    const m = this.mem;
    m.last = new THREE.Vector3();
    m.noise = new THREE.Vector3();
    m.patrol = new THREE.Vector3();
    m.havePatrol = false;
    m.patrolUntil = 0;
    m.sniffUntil = 0;
    m.nextSniff = 12 + Math.random() * 15;
    m.directAt = -99;
    m.senseAt = -99;
    m.noiseDone = -1;
    m.arrived = false;
    m.invUntil = 0;
    m.invFail = 0;
    m.sniffEnd = 0;
    m.nextIdle = 5 + Math.random() * 10;
  }

  onSpawn() {
    this.setState('patrol');
  }

  think(dt) {
    const m = this.mem;
    const p = this.player;
    const now = this.ctx.time;
    const mul = this.speedMul();

    if (!p?.alive || this.inGrace()) {
      this.anim = 'walk';
      this.wander(dt, 2.0);
      return;
    }

    const sees = this.canSeePlayer();
    if (sees) m.directAt = now;
    let hears = this.canHearPlayer();
    // while running to a noise it ignores footsteps until it gets there (no flip-flopping)
    if (this.state === 'investigate' && !m.arrived) hears = false;

    // any noise redirects it, unless it has eyes on the player right now
    const h = this.heard(12);
    if (h && h.time > m.noiseDone && now - m.directAt > 1.0) {
      m.noiseDone = h.time;
      m.noise.copy(h.pos);
      m.arrived = false;
      m.invFail = now + 22;
      this.endChase();
      this.setState('investigate');
      this._wander = null;
      hears = false;
    }

    if ((sees || hears) && this.state !== 'hunt') {
      this.setState('hunt');
      m.senseAt = now;
      m.last.copy(p.pos);
      this.startChase();
    }

    switch (this.state) {
      case 'hunt': {
        if (sees || hears) {
          m.last.copy(p.pos);
          m.senseAt = now;
        }
        this.anim = 'run';
        this.startChase();
        this.voice('chase', { minGap: 3.5 });
        const left = this.moveToward(m.last, 8.2 * mul, dt, { turn: 8 });
        this.tryKill();
        if ((left < 2.5 && now - m.senseAt > 0.3) || now - m.senseAt > 8) {
          this.setState('sniff');
          m.sniffEnd = now + 6;
          this._wander = null;
        }
        break;
      }

      case 'sniff': {
        this.anim = 'walk';
        this.wander(dt, 3.0, { around: m.last, radius: 10 });
        if (now > m.sniffEnd) {
          this.endChase();
          m.havePatrol = false;
          this.setState('patrol');
        }
        break;
      }

      case 'investigate': {
        if (!m.arrived) {
          this.anim = 'run';
          const left = this.moveToward(m.noise, 7.0 * mul, dt, { turn: 8 });
          if (left < 2.5 || now > m.invFail) {
            m.arrived = true;
            m.invUntil = now + 8;
            this._wander = null;
          }
        } else {
          this.anim = 'walk';
          this.wander(dt, 3.0, { around: m.noise, radius: 6 });
          if (now > m.invUntil) {
            m.havePatrol = false;
            this.setState('patrol');
          }
        }
        break;
      }

      default:
        this._patrol(dt, now);
    }
  }

  _patrol(dt, now) {
    const m = this.mem;
    if (this.state !== 'patrol') this.setState('patrol');

    if (now > m.nextIdle) {
      this.voice('idle');
      m.nextIdle = now + 10 + Math.random() * 15;
    }

    // stopping to sniff the air
    if (now < m.sniffUntil) {
      this.anim = 'idle';
      this.stop();
      this.yaw += Math.sin(this.t * 2.2) * 1.2 * dt;
      return;
    }
    if (now > m.nextSniff) {
      m.sniffUntil = now + 2.5 + Math.random() * 2.5;
      m.nextSniff = m.sniffUntil + 14 + Math.random() * 22;
      return;
    }

    if (!m.havePatrol || this.distTo(m.patrol) < 3 || now > m.patrolUntil) {
      // far-apart points: take the farthest of a few picks
      let best = null;
      let bd = -1;
      for (let i = 0; i < 3; i++) {
        const pt = this.pickPointNear(this.pos, 90);
        const dd = this.distTo(pt);
        if (dd > bd) {
          bd = dd;
          best = pt;
        }
      }
      m.patrol.copy(best);
      m.havePatrol = true;
      m.patrolUntil = now + 45;
    }
    this.anim = 'walk';
    this.moveToward(m.patrol, 3.2, dt);
  }
}
