// LESHY — the tree that isn't. Stands motionless beside real trees, relocates closer while
// unobserved, grabs anything within 3 m. Light within 14 m reveals it and it shambles away.

import { Creature, clamp } from '../base.js';
import * as THREE from 'three';

const TAU = Math.PI * 2;
const _eye = new THREE.Vector3();

export default class Leshy extends Creature {
  init() {
    this.radius = 0.6;
    this.sightRange = 0;
    this.fov = TAU;
    this.hearing = 0;
    this.killRange = 3.6;
    this.state = 'rooted';
    const m = this.mem;
    m.nextReloc = 8 + Math.random() * 6;
    m.grabCd = 0;
    m.revealCd = 0;
    m.nextIdle = 20 + Math.random() * 15;
    m.spot = new THREE.Vector3();
    m.nextTry = 0;
  }

  // rocks do not distract it
  onNoise() {}

  /** A spot 1.5-2.5 m from a real tree near `anchor`. Writes into out; returns bool. */
  _treeSpot(anchor, out, checkView) {
    const w = this.ctx.world;
    const p = this.ctx.player;
    const trees = w?.trees;
    if (!trees || !trees.length) return false;
    // reservoir-sample a tree within 5 m of the anchor
    let pick = null;
    let n = 0;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const dx = t.x - anchor.x;
      if (dx > 5 || dx < -5) continue;
      const dz = t.z - anchor.z;
      if (dx * dx + dz * dz > 25) continue;
      n++;
      if (Math.random() * n < 1) pick = t;
    }
    if (!pick) return false;
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * TAU;
      const d = Math.max(1.5 + Math.random(), (pick.radius || 0.4) + 0.9);
      const x = pick.x + Math.sin(a) * d;
      const z = pick.z + Math.cos(a) * d;
      if (w.isWater?.(x, z) || this._blocked(x, z)) continue;
      const y = w.heightAt?.(x, z) ?? 0;
      if (checkView && p) {
        const dx = x - p.pos.x;
        const dz = z - p.pos.z;
        const dd = Math.hypot(dx, dz) || 1;
        if (dd < 8) continue;
        if ((dx / dd) * p.forward.x + (dz / dd) * p.forward.z > 0.3) {
          _eye.set(x, y + 1.6, z);
          if (!w.lineOfSight || w.lineOfSight(_eye, p.eye)) continue;
        }
      }
      out.set(x, y, z);
      return true;
    }
    return false;
  }

  /** Choose a relocation spot 9-16 m from the player, preferring ahead of travel. */
  _findRelocSpot(out) {
    const p = this.ctx.player;
    const w = this.ctx.world;
    const hasTrees = w?.trees && w.trees.length;
    if (!hasTrees) {
      const pt = this.pickPointAroundPlayer(9, 16, { unseen: true });
      if (!pt) return false;
      out.copy(pt);
      return true;
    }
    const moving = p.speed > 1 && p.velocity;
    const baseYaw = moving ? Math.atan2(p.velocity.x, p.velocity.z) : Math.random() * TAU;
    for (let i = 0; i < 3; i++) {
      const a = baseYaw + (Math.random() - 0.5) * 1.1;
      const r = 9 + Math.random() * 7;
      _eye.set(p.pos.x + Math.sin(a) * r, 0, p.pos.z + Math.cos(a) * r);
      if (this._treeSpot(_eye, out, true)) return true;
    }
    const anchor = this.pickPointAroundPlayer(9, 16, { unseen: true });
    if (anchor && this._treeSpot(anchor, out, true)) return true;
    if (anchor) {
      out.copy(anchor);
      return true;
    }
    return false;
  }

  _root(spot) {
    const p = this.ctx.player;
    this.teleport(spot);
    if (p) this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    this.mem.nextReloc = this.ctx.time + 8 + Math.random() * 6;
  }

  onSpawn() {
    const m = this.mem;
    if (this._treeSpot(this.pos, m.spot, false)) this.teleport(m.spot);
    else if (this.ctx.world?.trees?.length) {
      // nearest-tree fallback: snap to a random tree
      const t = this.ctx.world.trees[(Math.random() * this.ctx.world.trees.length) | 0];
      if (this._treeSpot(t, m.spot, false)) this.teleport(m.spot);
    } else {
      this.teleport(this.pickPointNear(this.pos, 8));
    }
  }

  think(dt) {
    const m = this.mem;
    const ctx = this.ctx;
    const p = ctx.player;
    const now = ctx.time;
    const d = this.distToPlayer();
    const grace = this.inGrace();

    switch (this.state) {
      case 'grab': {
        this.anim = 'attack';
        this.stop();
        this.faceToward(p.pos, dt, 10);
        if (this.stateTime >= 0.45) {
          if (this.tryKill(3.6)) return;
          m.grabCd = now + 6;
          this.setState('rooted');
        }
        break;
      }

      case 'revealed': {
        if (this.stateTime < 0.7) {
          this.anim = 'special';
          this.stop();
          this.faceToward(p.pos, dt, 4);
        } else if (this.stateTime < 4.7) {
          this.anim = 'walk';
          this.moveAway(p.pos, 2.4, dt, { turn: 3 });
        } else {
          this.endChase();
          m.revealCd = now + 5;
          m.nextReloc = now + 2 + Math.random() * 2;
          this.setState('rooted');
        }
        break;
      }

      default: {
        if (this.state !== 'rooted') this.setState('rooted');
        this.anim = 'frozen';
        this.stop();
        if (grace) break;

        if (d < 3.0 && now > m.grabCd && p.alive) {
          this.setState('grab');
          this.voice('attack', { minGap: 0 });
          break;
        }
        if (d < 14 && now > m.revealCd && this.isLit()) {
          this.setState('revealed');
          this.voice('special', { minGap: 0 });
          this.startChase();
          break;
        }
        if (now > m.nextReloc && now > m.nextTry && d > 12 && !this.isObserved()) {
          if (this._findRelocSpot(m.spot)) {
            this._root(m.spot);
            // _root also schedules the next relocation
          } else m.nextTry = now + 1.5;
        }
        if (now > m.nextIdle && d < 35) {
          m.nextIdle = now + 20 + Math.random() * 20;
          this.voice('idle', { volume: 0.6 });
        }
        break;
      }
    }
  }
}
