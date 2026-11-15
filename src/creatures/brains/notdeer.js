// NOT-DEER — moves only when unobserved. Perfectly still while watched, very fast otherwise.
// Counter: keep it lit/in view and back away; break line of sight and hide.

import { Creature } from '../base.js';
import * as THREE from 'three';

const TAU = Math.PI * 2;

export default class NotDeer extends Creature {
  init() {
    this.radius = 0.5;
    this.sightRange = 40;
    this.fov = TAU;
    this.hearing = 1;
    this.turnRate = 9;
    this.killRange = 1.5;
    this.state = 'wander';
    const m = this.mem;
    m.freezeUntil = 0;
    m.lastSense = -1e9;
    m.known = new THREE.Vector3();
    m.nextRepo = 30 + Math.random() * 20;
    m.nextIdle = 12 + Math.random() * 12;
  }

  // rocks do not distract it
  onNoise() {}

  think(dt) {
    const m = this.mem;
    const ctx = this.ctx;
    const p = ctx.player;
    const now = ctx.time;

    if (this.isObserved()) {
      this.anim = 'frozen';
      this.stop();
      this.speed = 0;
      m.freezeUntil = now + 0.15 + Math.random() * 0.25;
      if (this.distToPlayer() < 1.2) this.tryKill(1.2);
      return;
    }
    if (now < m.freezeUntil) {
      this.anim = 'frozen';
      this.stop();
      this.speed = 0;
      if (this.distToPlayer() < 1.2) this.tryKill(1.2);
      return;
    }

    // --- sensing ---
    if (!this.inGrace() && (this.canSeePlayer({ range: 40, fov: TAU }) || this.canHearPlayer(1.5))) {
      m.lastSense = now;
      m.known.copy(p.pos);
    }
    const knows = now - m.lastSense < 6;

    if (knows) {
      this.setState('hunt');
      const d = this.distToPlayer();
      if (d < 15) this.startChase();
      this.anim = 'run';
      const left = this.moveToward(m.known, 9 * this.speedMul(), dt, { turn: 9 });
      if (left < 0.8) {
        this.stop();
        this.anim = 'idle';
      }
      if (this.tryKill(1.5)) return;
      return;
    }

    // --- lost the player: relocate ---
    this.endChase();
    this.setState('wander');
    this.anim = 'walk';
    this.wander(dt, 2.2, { radius: 60 });
    const d = this.distToPlayer();
    if (now > m.nextRepo && d > 25 && !this.inGrace()) {
      const pt = this.pickPointAroundPlayer(18, 28, { unseen: true });
      if (pt) {
        this.teleport(pt);
        this.yaw = Math.atan2(p.pos.x - pt.x, p.pos.z - pt.z);
        this.anim = 'frozen';
        m.nextRepo = now + 30 + Math.random() * 20;
        m.freezeUntil = now + 0.5;
      } else m.nextRepo = now + 3;
    }
    if (now > m.nextIdle && d < 50) {
      m.nextIdle = now + 12 + Math.random() * 14;
      this.voice('idle', { volume: 0.8 });
    }
  }
}
