// SKINWALKER — stalker. Rings the player at 18-30 m, closes only while unobserved,
// retreats from light, charges when you turn your back too long or it gets within 9 m unseen.
// States: prowl | retreat | charge | lost
import * as THREE from 'three';
import { Creature, clamp, lerp, angleDelta } from '../base.js';

export default class Skinwalker extends Creature {
  init() {
    this.sightRange = 34;
    this.fov = 3.0;
    this.hearing = 1.2;
    this.killRange = 1.6;
    this.radius = 0.45;
    this.turnRate = 7;
    const m = this.mem;
    m.ringR = 26;
    m.dir = Math.random() < 0.5 ? 1 : -1;
    m.nextFlip = 6 + Math.random() * 8;
    m.behindT = 0;
    m.nextIdle = 6 + Math.random() * 10;
    m.phase = 0;
    m.reenterAt = 0;
    m.pickT = 0;
    m.unseenT = 0;
    m.lostEnd = 0;
    m.warned = false;
  }

  onSpawn() {
    this.setState('prowl');
    this.anim = 'walk';
  }

  think(dt) {
    const m = this.mem;
    const p = this.player;
    const now = this.ctx.time;
    const mul = this.speedMul();

    if (!p?.alive || this.inGrace()) {
      this.anim = 'walk';
      this.wander(dt, 1.4);
      return;
    }

    const d = this.distToPlayer();
    const sees = this.canSeePlayer();
    const knows = !(p.hidden && now > this.sawHideUntil);

    if (this.state !== 'charge' && now > m.nextIdle) {
      this.voice('idle');
      m.nextIdle = now + 10 + Math.random() * 15;
    }

    switch (this.state) {
      case 'charge': {
        this.anim = 'run';
        this.startChase();
        this.voice('chase', { minGap: 4 });
        if (this.stateTime < 1 && d > 6 && this.isLit()) {
          this._retreat();
          break;
        }
        if (sees) {
          m.unseenT = 0;
          this.moveToward(p.pos, 7.6 * mul, dt, { turn: 9 });
        } else {
          m.unseenT += dt;
          const left = this.moveToward(this.lastSeenPos, 7.6 * mul, dt, { turn: 9 });
          if (m.unseenT > 1.5 || !knows || left < 1) {
            this._lose();
            break;
          }
        }
        this.tryKill();
        break;
      }

      case 'retreat': {
        if (m.phase === 0) {
          // back away fast into the dark
          this.anim = 'run';
          this.moveAway(p.pos, 6, dt, { turn: 10 });
          if ((d >= 32 && !this.isLit()) || this.stateTime > 7) {
            m.phase = 1;
            m.reenterAt = now + 3 + Math.random() * 3;
            this.mem.waitStart = now;
          }
        } else if (this.isLit() && d < 36) {
          this.anim = 'run';
          this.moveAway(p.pos, 6, dt, { turn: 10 });
        } else {
          // wait in the dark, watching, then re-enter from another bearing
          this.anim = 'idle';
          this.stop();
          this.faceToward(p.pos, dt, 4);
          if (now > m.reenterAt && now > m.pickT) {
            m.pickT = now + 0.7;
            if (d > 30 && !this.isObserved()) {
              const pt = this.pickPointAroundPlayer(24, 30, { behind: true });
              if (pt) {
                this.teleport(pt);
                this._resumeProwl(this.distToPlayer());
                break;
              }
            }
          }
          if (now - m.waitStart > 12) this._resumeProwl(d);
        }
        break;
      }

      case 'lost': {
        this.anim = 'walk';
        if (this.isLit()) {
          this._retreat();
          break;
        }
        this.wander(dt, 2.0, { around: this.lastSeenPos, radius: 12 });
        if (knows && this.stateTime > 4) this._resumeProwl(d);
        break;
      }

      default:
        this._prowl(dt, p, d, knows, mul, now);
    }
  }

  _retreat() {
    this.endChase();
    this.setState('retreat');
    this.mem.phase = 0;
    this.voice('alert', { minGap: 3 });
  }

  _lose() {
    this.endChase();
    this.setState('lost');
    this.mem.lostEnd = this.ctx.time + 8;
  }

  _resumeProwl(d) {
    const m = this.mem;
    m.ringR = clamp(d, 14, 30);
    m.behindT = 0;
    m.warned = false;
    this.setState('prowl');
  }

  _prowl(dt, p, d, knows, mul, now) {
    const m = this.mem;
    if (this.state !== 'prowl') this.setState('prowl');

    if (!knows) {
      // they hid unseen: lose them and prowl around the last known spot
      if (this.timeSinceSeen() > 30) this.lastSeenPos.copy(p.pos);
      this.endChase();
      this.setState('lost');
      return;
    }
    if (this.isLit()) {
      this._retreat();
      return;
    }

    const observed = this.isObserved();

    // how long has the player had their back to me?
    if (d < 22 && this.isBehindPlayer(-0.2)) m.behindT += dt;
    else m.behindT = Math.max(0, m.behindT - dt * 1.5);

    if (m.behindT > 6 || (d < 9 && !observed)) {
      this.setState('charge');
      m.unseenT = 0;
      this.startChase();
      this.voice('chase', { minGap: 0 });
      return;
    }

    if (now > m.nextFlip) {
      m.dir = -m.dir;
      m.nextFlip = now + 6 + Math.random() * 10;
    }

    this.anim = 'walk';
    if (d > 34 && !observed) {
      // far away in the dark: come in toward the ring
      this.moveToward(p.pos, 5, dt);
      m.ringR = d;
    } else if (observed) {
      // watched: hold the distance, shuffle sideways, never look away
      m.ringR = d;
      this.faceToward(p.pos, dt, 6);
      this.orbit(p.pos, d, 1.3, dt, m.dir, { strafe: true });
    } else {
      // unobserved: the ring tightens
      m.ringR = Math.max(5, Math.min(m.ringR, d + 1) - 2.5 * dt);
      this.orbit(p.pos, m.ringR, 3.0, dt, m.dir);
      if (d < 14 && !m.warned) {
        m.warned = true;
        this.voice('alert');
      }
    }
  }
}
