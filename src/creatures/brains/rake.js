// THE RAKE — ambusher. Crawls low, works around behind the player, rushes when your back is
// turned or your light is off. Light makes it shriek and flee, then it returns from a new angle.
// States: creep | rush | flee | cool
import * as THREE from 'three';
import { Creature, clamp, lerp, angleDelta } from '../base.js';

const _goal = new THREE.Vector3();

export default class Rake extends Creature {
  init() {
    this.radius = 0.4;
    this.sightRange = 24;
    this.fov = 2.8;
    this.hearing = 1.3;
    this.killRange = 1.4;
    this.turnRate = 6;
    const m = this.mem;
    m.lightAcc = 0;
    m.coolUntil = 0;
    m.wp = new THREE.Vector3();
    m.hasWp = false;
    m.wpUntil = 0;
    m.pickT = 0;
    m.orbitDir = Math.random() < 0.5 ? 1 : -1;
    m.nextIdle = 6 + Math.random() * 12;
    m.warned = false;
  }

  onSpawn() {
    this.setState('creep');
    this.anim = 'crawl';
  }

  think(dt) {
    const m = this.mem;
    const p = this.player;
    const now = this.ctx.time;
    const mul = this.speedMul();

    if (!p?.alive || this.inGrace()) {
      this.anim = 'crawl';
      this.wander(dt, 1.6);
      return;
    }

    const d = this.distToPlayer();
    this.canSeePlayer(); // keeps sawHideUntil / lastSeenPos fresh
    const hiddenUnseen = p.hidden && now > this.sawHideUntil;
    const sensed = d < 60 && !hiddenUnseen;
    const lightOn = !!p.flashlight?.on;

    if (now > m.nextIdle) {
      this.voice('idle');
      m.nextIdle = now + 10 + Math.random() * 15;
    }

    // light accumulates; ~0.25 s of it sends the rake screaming away
    if (this.state !== 'flee' && this.isLit()) m.lightAcc += dt;
    else m.lightAcc = Math.max(0, m.lightAcc - dt * 0.6);
    if (this.state !== 'flee' && m.lightAcc >= 0.25) {
      m.lightAcc = 0;
      this.endChase();
      this.setState('flee');
    }

    switch (this.state) {
      case 'flee': {
        if (this.stateTime < 0.6) {
          this.anim = 'special';
          this.stop();
          this.faceToward(p.pos, dt, 10);
          this.voice('special', { minGap: 0 });
        } else if (this.stateTime < 5.6) {
          this.anim = 'crawl';
          this.moveAway(p.pos, 8, dt, { turn: 10 });
        } else {
          this.endChase();
          m.coolUntil = now + 6 + Math.random() * 6;
          m.hasWp = false;
          this.setState('cool');
        }
        break;
      }

      case 'cool': {
        if (d < 28) {
          this.anim = 'crawl';
          this.moveAway(p.pos, 4, dt);
        } else {
          this.anim = 'idle';
          this.stop();
          this.faceToward(p.pos, dt, 3);
        }
        if (now > m.coolUntil) {
          if (now > m.pickT) {
            m.pickT = now + 1;
            const pt = this.pickPointAroundPlayer(25, 40, { behind: true });
            if (pt) {
              m.wp.copy(pt);
              m.hasWp = true;
              m.wpUntil = now + 14;
              m.warned = false;
              this.setState('creep');
            }
          }
          if (now > m.coolUntil + 3) this.setState('creep');
        }
        break;
      }

      case 'rush': {
        this.anim = 'crawl';
        this.startChase();
        if (this.stateTime < 0.35) {
          // the tell: it stops, tenses and hisses before it lunges
          this.stop();
          this.faceToward(p.pos, dt, 12);
          this.voice('chase', { minGap: 3 });
          break;
        }
        if (!sensed || d > 32) {
          this.endChase();
          this.setState('creep');
          break;
        }
        this.moveToward(p.pos, 7.4 * mul, dt, { turn: 10 });
        this.tryKill();
        break;
      }

      default:
        this._creep(dt, p, d, sensed, hiddenUnseen, lightOn, now);
    }
  }

  _creep(dt, p, d, sensed, hiddenUnseen, lightOn, now) {
    const m = this.mem;
    if (this.state !== 'creep') this.setState('creep');
    this.anim = 'crawl';

    if (!sensed) {
      // can't find them: drift toward the last noise / last sighting
      const h = this.heard(30);
      if (h && this.distTo(h.pos) > 3) {
        this.moveToward(h.pos, 3.0, dt);
      } else if (hiddenUnseen && this.timeSinceSeen() < 90 && this.distTo(this.lastSeenPos) > 4) {
        this.moveToward(this.lastSeenPos, 2.6, dt);
      } else if (d >= 60) {
        this.wander(dt, 2.6, { around: p.pos, radius: 55 });
      } else {
        this.wander(dt, 2.0, { around: hiddenUnseen ? this.lastSeenPos : this.pos, radius: 20 });
      }
      return;
    }

    // the intermediate waypoint after fleeing: come back from a new angle
    if (m.hasWp) {
      const left = this.moveToward(m.wp, 4.0, dt);
      if (left < 3 || now > m.wpUntil) m.hasWp = false;
      return;
    }

    const bold = !lightOn;
    if (d < 14 && (bold || this.isBehindPlayer())) {
      this.setState('rush');
      this.startChase();
      return;
    }

    if (d < 22 && !m.warned) {
      m.warned = true;
      this.voice('alert');
    }

    let fx = p.forward.x;
    let fz = p.forward.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;

    if (bold) {
      // no light to fear: close in from any direction
      this.moveToward(p.pos, 3.6, dt);
      return;
    }

    const inv = 1 / (d || 1);
    const dot = ((this.pos.x - p.pos.x) * fx + (this.pos.z - p.pos.z) * fz) * inv;
    if (dot > 0.3) {
      // in front of them: circle wide rather than walk into the beam
      this.orbit(p.pos, Math.max(16, d - 0.6), 3.2, dt, m.orbitDir);
    } else {
      // head for a spot ~12 m behind them
      _goal.set(p.pos.x - fx * 12, 0, p.pos.z - fz * 12);
      this.moveToward(_goal, 3.2, dt);
    }
  }
}
