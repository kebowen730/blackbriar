// WENDIGO — relentless tracker. Follows the player's scent trail forever, sprints on sight.
// States: track | stalk (investigating a noise) | chase | search
import * as THREE from 'three';
import { Creature, clamp, lerp, angleDelta } from '../base.js';

// first index whose crumb time >= t (trail is sorted by time, oldest first)
function lowerBound(trail, t) {
  let lo = 0;
  let hi = trail.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (trail[mid].time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export default class Wendigo extends Creature {
  init() {
    this.sightRange = 20;
    this.fov = 2.2;
    this.hearing = 1;
    this.killRange = 1.7;
    this.radius = 0.5;
    this.turnRate = 4.5;
    const m = this.mem;
    m.haveCrumb = false;
    m.crumbTime = 0;
    m.noise = new THREE.Vector3();
    m.handledNoise = -1;
    m.rough = new THREE.Vector3();
    m.roughAt = -99;
    m.nextMimic = 8 + Math.random() * 10;
    m.lostT = 0;
    m.phase = 0;
    m.lookT = 0;
  }

  onSpawn() {
    this.setState('track');
    this.anim = 'walk';
  }

  think(dt) {
    const m = this.mem;
    const p = this.player;
    const now = this.ctx.time;
    const mul = this.speedMul();

    if (!p?.alive || this.inGrace()) {
      this.anim = 'walk';
      this.wander(dt, 1.6);
      return;
    }

    const sees = this.canSeePlayer();
    if (sees && this.state !== 'chase') {
      this.setState('chase');
      m.lostT = 0;
      this.startChase();
      this.voice('chase', { minGap: 6 });
    }

    switch (this.state) {
      case 'chase': {
        this.anim = 'run';
        if (sees) m.lostT = 0;
        else m.lostT += dt;
        this.moveToward(sees ? p.pos : this.lastSeenPos, 7.0 * mul, dt, { turn: 7 });
        this.voice('chase', { minGap: 5 });
        this.tryKill();
        if (m.lostT > 3) {
          this.setState('search');
          m.phase = 0;
          m.lookT = 0;
        }
        break;
      }

      case 'search': {
        if (m.phase === 0) {
          // run to where we last saw them
          this.anim = 'walk';
          const left = this.moveToward(this.lastSeenPos, 4.6 * mul, dt, { turn: 6 });
          if (left < 2 || this.stateTime > 10) {
            m.phase = 1;
            m.lookT = 0;
          }
        } else {
          // stand and look around, head sweeping
          this.anim = 'idle';
          this.stop();
          m.lookT += dt;
          this.yaw += Math.sin(m.lookT * 1.6) * 1.9 * dt + 0.5 * dt;
          if (m.lookT > 6) {
            this.endChase();
            m.haveCrumb = false;
            this.setState('track');
          }
        }
        break;
      }

      case 'stalk': {
        const h = this.heard(12);
        if (h && h.time > m.handledNoise) {
          m.handledNoise = h.time;
          m.noise.copy(h.pos);
          this.stateTime = 0;
        }
        const left = this.distTo(m.noise);
        if (left > 2.5) {
          this.anim = 'walk';
          this.moveToward(m.noise, 3.0 * mul, dt);
        } else {
          this.anim = 'idle';
          this.stop();
          this.yaw += Math.sin(this.t * 1.4) * 1.5 * dt;
        }
        if (this.stateTime > 12) {
          m.haveCrumb = false;
          this.setState('track');
        }
        break;
      }

      default:
        this._track(dt, p, now, mul);
    }
  }

  _track(dt, p, now, mul) {
    const m = this.mem;
    if (this.state !== 'track') this.setState('track');

    // a noise pulls it off the trail for a while
    const h = this.heard(12);
    if (h && h.time > m.handledNoise) {
      m.handledNoise = h.time;
      m.noise.copy(h.pos);
      this.setState('stalk');
      return;
    }

    const d = this.distToPlayer();
    // human-voice mimic from afar
    if (d > 35 && now > m.nextMimic) {
      this.voice('special', { minGap: 10 });
      m.nextMimic = now + 14 + Math.random() * 18;
    }

    this.anim = 'walk';
    const speed = 2.6 * mul;
    const trail = this.ctx.creatures?.trail;
    if (!trail || trail.length === 0) {
      // no scent: drift toward the player's rough direction
      if (now - m.roughAt > 4) {
        m.roughAt = now;
        m.rough.set(p.pos.x + (Math.random() - 0.5) * 40, 0, p.pos.z + (Math.random() - 0.5) * 40);
      }
      this.moveToward(m.rough, speed, dt);
      return;
    }

    if (!m.haveCrumb) {
      // latch on to the nearest crumb of the trail
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < trail.length; i++) {
        const c = trail[i].pos;
        const dd = (c.x - this.pos.x) * (c.x - this.pos.x) + (c.z - this.pos.z) * (c.z - this.pos.z);
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
      m.crumbTime = trail[best].time;
      m.haveCrumb = true;
    }

    let i = lowerBound(trail, m.crumbTime);
    // skip crumbs we're already standing on (a few per frame)
    for (let k = 0; k < 4 && i < trail.length; k++) {
      if (this.distTo(trail[i].pos) < 1.6) {
        m.crumbTime = trail[i].time + 1e-6;
        i++;
      } else break;
    }
    const target = i < trail.length ? trail[i].pos : p.pos;
    this.moveToward(target, speed, dt);
  }
}
