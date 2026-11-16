// Creature base class. Every brain in ./brains/<id>.js does:
//
//   import { Creature } from '../base.js';
//   export default class Wendigo extends Creature {
//     init() { this.sightRange = 22; ... }      // tuning, called once from the constructor
//     onSpawn() { ... }                         // optional, after being placed in the world
//     think(dt) { ... }                         // every frame while playing (not while frozen)
//     onNoise(evt) { super.onNoise(evt); ... }  // optional
//     onAlert(pos) { super.onAlert(pos); ... }  // optional (banshee scream etc.)
//     dispose() { ... }                         // optional: stop audio loops, restore player state
//   }
//
// Brains never touch the model: they set `this.anim`, move with the helpers below and
// call `this.tryKill()` when close enough. All positions are THREE.Vector3, y = ground.
//
// Reference numbers: player walks 3.4 m/s, sprints 6.4 m/s, crouch-walks 1.6 m/s.
// Flashlight reaches ~32 m with a ~24° half-angle cone.

import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _head = new THREE.Vector3();
const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export class Creature {
  constructor(ctx, def, model) {
    this.ctx = ctx;
    this.def = def; // entry from src/data/creatures.js
    this.id = def.id;
    this.model = model; // { group, height, eyeHeight, animate }
    this.group = model.group;
    this.pos = this.group.position; // feet position (y is managed by the move helpers)

    // --- kinematic state -------------------------------------------------
    this.yaw = 0; // facing; forward = (sin yaw, 0, cos yaw)
    this.speed = 0; // current horizontal m/s — set by move helpers, read by the model animation
    this.altitude = 0; // metres above the ground (flyers / hoverers set this; lerp it yourself)
    this.anim = 'idle'; // 'idle'|'walk'|'run'|'crawl'|'fly'|'attack'|'special'|'frozen'
    this.radius = 0.5; // collision radius
    this.turnRate = 5; // rad/s when steering

    // --- behaviour state --------------------------------------------------
    this.state = 'idle';
    this.stateTime = 0; // seconds in the current state
    this.t = Math.random() * 100; // personal clock (also the animation clock)
    this.chasing = false; // true while actively hunting the player (drives music/tension)
    this.frozen = false; // set by FX during the death jumpscare — think() is skipped
    this.active = true;
    this.mem = {}; // free scratch space for brains

    // --- senses (tune in init) --------------------------------------------
    this.sightRange = 16; // metres at which it can see a standing player in the dark
    this.fov = 2.4; // total field of view in radians (use Math.PI * 2 for all-round)
    this.hearing = 1; // multiplier on the player's noise radius and on noise events
    this.killRange = 1.5;
    this.lastHeard = null; // { pos: Vector3, time, kind } — most recent noise it noticed
    this.lastSeenPos = new THREE.Vector3(); // where it last saw the player
    this.lastSeenTime = -1e9; // ctx.time of that sighting
    this.sawHideUntil = -1; // if the player hides before this time, the creature isn't fooled

    this._frame = -1;
    this._los = false;
    this._lit = false;
    this._voiceAt = {};
    this._wander = null;
    this._wanderUntil = 0;

    this.init?.();
  }

  // ======================================================================
  // Queries
  // ======================================================================

  get player() {
    return this.ctx.player;
  }

  /** Horizontal distance to the player. */
  distToPlayer() {
    const p = this.ctx.player.pos;
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }

  /** Horizontal distance to any point. */
  distTo(v) {
    return Math.hypot(v.x - this.pos.x, v.z - this.pos.z);
  }

  /** World position of the head (for LOS / flashlight tests). */
  headPos(out = _head) {
    return out.set(this.pos.x, this.pos.y + (this.model.eyeHeight || 1.6), this.pos.z);
  }

  /** Speed multiplier from difficulty + rising aggression. Multiply your chase speeds by this. */
  speedMul() {
    return (this.ctx.difficultyMul || 1) * (1 + 0.3 * (this.ctx.aggression || 0));
  }

  /** True during the opening grace period (creatures should not hunt yet). */
  inGrace() {
    return this.ctx.time < (this.ctx.graceTime ?? 12);
  }

  _refreshFrameCache() {
    const f = this.ctx.frame | 0;
    if (this._frame === f) return;
    this._frame = f;
    const p = this.ctx.player;
    const w = this.ctx.world;
    const head = this.headPos(_a);
    this._los = w?.lineOfSight ? !!w.lineOfSight(head, p.eye) : true;
    this._lit = false;
    const fl = p.flashlight;
    if (fl?.on && this._los) {
      // test head and chest so a partly lit creature still counts
      this._lit =
        !!fl.isIlluminating?.(head, 0.9) ||
        !!fl.isIlluminating?.(_b.set(this.pos.x, this.pos.y + (this.model.eyeHeight || 1.6) * 0.5, this.pos.z), 0.9);
    }
  }

  /** Unobstructed line between my head and the player's eyes (cached per frame). */
  hasLineOfSight() {
    this._refreshFrameCache();
    return this._los;
  }

  /** The player's flashlight beam is on me right now (cached per frame). */
  isLit() {
    this._refreshFrameCache();
    return this._lit;
  }

  /**
   * The player can currently see me: I'm inside their view cone with line of sight, and
   * either the flashlight is on (out to ~60 m) or I'm very close (< 10 m in the dark).
   */
  isObserved() {
    const p = this.ctx.player;
    const d = this.distToPlayer();
    const maxD = p.flashlight?.on ? 60 : 10;
    if (d > maxD) return false;
    const dx = this.pos.x - p.pos.x;
    const dz = this.pos.z - p.pos.z;
    const inv = 1 / (Math.hypot(dx, dz) || 1);
    const fh = Math.hypot(p.forward.x, p.forward.z) || 1;
    const dot = (dx * inv * p.forward.x + dz * inv * p.forward.z) / fh;
    if (dot < 0.55) return false; // ~57° half-angle view cone
    return this.hasLineOfSight();
  }

  /** Is the player facing away from me (I'm behind them)? */
  isBehindPlayer(threshold = -0.2) {
    const p = this.ctx.player;
    const dx = this.pos.x - p.pos.x;
    const dz = this.pos.z - p.pos.z;
    const inv = 1 / (Math.hypot(dx, dz) || 1);
    const fh = Math.hypot(p.forward.x, p.forward.z) || 1;
    return (dx * inv * p.forward.x + dz * inv * p.forward.z) / fh < threshold;
  }

  /**
   * Can I see the player? Accounts for range, darkness (a lit flashlight is visible from
   * much further), crouching, hiding, my field of view and line of sight.
   * opts: { range = this.sightRange, fov = this.fov, ignoreLight = false }
   * Side effect on success: updates lastSeenPos / lastSeenTime / sawHideUntil.
   */
  canSeePlayer(opts = {}) {
    const p = this.ctx.player;
    if (!p?.alive || this.inGrace()) return false;
    const d = this.distToPlayer();
    let range = opts.range ?? this.sightRange;
    if (p.flashlight?.on && !opts.ignoreLight) range = Math.min(range * 2.4, 62);
    if (p.isCrouching) range *= 0.6;
    if (p.isSprinting) range *= 1.2;
    if (d > range) return false;
    if (p.hidden && this.ctx.time > this.sawHideUntil) return false;
    if (d > 3) {
      const fov = opts.fov ?? this.fov;
      if (fov < TAU - 0.01) {
        const want = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
        if (Math.abs(angleDelta(this.yaw, want)) > fov / 2) return false;
      }
    }
    if (!this.hasLineOfSight()) return false;
    this.lastSeenPos.copy(p.pos);
    this.lastSeenTime = this.ctx.time;
    this.sawHideUntil = this.ctx.time + 1.5;
    return true;
  }

  /** Seconds since I last saw the player. */
  timeSinceSeen() {
    return this.ctx.time - this.lastSeenTime;
  }

  /** Can I hear the player's movement right now? (player.noiseRadius: still 0, crouch ~3, walk ~10, sprint ~26) */
  canHearPlayer(mult = 1) {
    const p = this.ctx.player;
    if (!p?.alive || this.inGrace()) return false;
    return this.distToPlayer() < (p.noiseRadius || 0) * this.hearing * mult;
  }

  // ======================================================================
  // State
  // ======================================================================

  setState(name) {
    if (this.state === name) return;
    this.state = name;
    this.stateTime = 0;
  }

  /** Mark that I'm actively hunting the player (plays a stinger once, raises tension). */
  startChase() {
    if (this.chasing) return;
    this.chasing = true;
    this.ctx.bus.emit('creature:alert', { id: this.id, creature: this });
  }

  endChase() {
    this.chasing = false;
  }

  /** Play my synthesized voice. kind: 'idle'|'alert'|'chase'|'attack'|'special'. Rate-limited per kind. */
  voice(kind = 'idle', { volume = 1, minGap = 2.5 } = {}) {
    const now = this.ctx.time;
    if (now - (this._voiceAt[kind] ?? -99) < minGap) return;
    this._voiceAt[kind] = now;
    this.ctx.audio?.creatureVoice?.(this.id, kind, this.headPos(_a).clone(), { volume });
  }

  /**
   * Kill the player if within range. Hidden players are safe unless I watched them hide.
   * Returns true if the kill happened.
   */
  tryKill(range = this.killRange) {
    const p = this.ctx.player;
    if (!p?.alive || this.inGrace()) return false;
    if (this.distToPlayer() > range) return false;
    if (p.hidden && this.ctx.time > this.sawHideUntil) return false;
    this.anim = 'attack';
    this.voice('attack', { minGap: 0 });
    p.kill(this);
    return true;
  }

  // ======================================================================
  // Movement
  // ======================================================================

  /** Smoothly turn to face a world point. */
  faceToward(target, dt, rate = this.turnRate) {
    const want = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    this.yaw += clamp(angleDelta(this.yaw, want), -rate * dt, rate * dt);
  }

  /**
   * Steer toward a point at `speed` m/s. Slides around trees/rocks. Returns remaining distance.
   * opts: { fly = false (ignore colliders), turn = this.turnRate, strafe = false (move without turning) }
   */
  moveToward(target, speed, dt, opts = {}) {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      this.speed = 0;
      this._settleY();
      return dist;
    }
    const want = Math.atan2(dx, dz);
    if (!opts.strafe) {
      const rate = opts.turn ?? this.turnRate;
      this.yaw += clamp(angleDelta(this.yaw, want), -rate * dt, rate * dt);
    }
    // move along the facing, but never overshoot; slow down if facing far off the target
    const facingErr = opts.strafe ? 0 : Math.abs(angleDelta(this.yaw, want));
    const throttle = facingErr > 1.6 ? 0.25 : facingErr > 0.8 ? 0.6 : 1;
    const step = Math.min(dist, speed * throttle * dt);
    const dirYaw = opts.strafe ? want : this.yaw;
    this._advance(Math.sin(dirYaw) * step, Math.cos(dirYaw) * step, opts.fly);
    this.speed = speed * throttle;
    return dist - step;
  }

  /**
   * Move in a fixed direction (yaw) without steering — for straight-line charges.
   * Returns true if something solid blocked most of the movement this frame.
   */
  moveStraight(yaw, speed, dt, opts = {}) {
    this.yaw = yaw;
    const sx = Math.sin(yaw) * speed * dt;
    const sz = Math.cos(yaw) * speed * dt;
    const bx = this.pos.x;
    const bz = this.pos.z;
    // sub-step so a fast charge cannot tunnel through a thin trunk collider
    const n = Math.max(1, Math.ceil(Math.hypot(sx, sz) / 0.35));
    for (let i = 0; i < n; i++) this._advance(sx / n, sz / n, opts.fly, i < n - 1);
    this.speed = speed;
    const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
    return moved < speed * dt * 0.45;
  }

  /** Move directly away from a point. */
  moveAway(from, speed, dt, opts = {}) {
    const dx = this.pos.x - from.x;
    const dz = this.pos.z - from.z;
    const inv = 1 / (Math.hypot(dx, dz) || 1);
    _b.set(this.pos.x + dx * inv * 10, 0, this.pos.z + dz * inv * 10);
    return this.moveToward(_b, speed, dt, opts);
  }

  /** Circle around a point at roughly `radius`, dir = +1 / -1. */
  orbit(center, radius, speed, dt, dir = 1, opts = {}) {
    const ang = Math.atan2(this.pos.x - center.x, this.pos.z - center.z) + dir * (speed / Math.max(radius, 1)) * dt * 8;
    _b.set(center.x + Math.sin(ang) * radius, 0, center.z + Math.cos(ang) * radius);
    return this.moveToward(_b, speed, dt, opts);
  }

  /**
   * Amble between random points. opts: { around: Vector3 (default: own position), radius = 45, fly }
   * Picks a new target on arrival or after ~14 s.
   */
  wander(dt, speed, opts = {}) {
    const now = this.ctx.time;
    if (!this._wander || now > this._wanderUntil || this.distTo(this._wander) < 1.5) {
      this._wander = this.pickPointNear(opts.around || this.pos, opts.radius ?? 45);
      this._wanderUntil = now + 10 + Math.random() * 8;
    }
    return this.moveToward(this._wander, speed, dt, opts);
  }

  /** Stand still (keeps y glued to the ground / altitude). */
  stop() {
    this.speed = 0;
    this._settleY();
  }

  /** Instantly relocate. */
  teleport(v) {
    this.pos.x = v.x;
    this.pos.z = v.z;
    this._settleY();
    this._wander = null;
  }

  /** Random walkable point within `radius` of `center` (clamped to the map). Returns a new Vector3. */
  pickPointNear(center, radius = 40) {
    const w = this.ctx.world;
    const half = (w?.half ?? 180) - 6;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU;
      const r = radius * (0.3 + 0.7 * Math.random());
      const x = clamp(center.x + Math.sin(a) * r, -half, half);
      const z = clamp(center.z + Math.cos(a) * r, -half, half);
      if (w?.isWater?.(x, z)) continue;
      if (this._blocked(x, z)) continue;
      return new THREE.Vector3(x, w?.heightAt?.(x, z) ?? 0, z);
    }
    return new THREE.Vector3(center.x, center.y, center.z);
  }

  /**
   * Find a walkable point at distance [minD, maxD] from the player.
   * opts: { behind = false (in the ~140° arc behind the player), unseen = true (no line of sight
   * to the player OR outside their view cone), tries = 14 }. Returns a new Vector3 or null.
   */
  pickPointAroundPlayer(minD, maxD, opts = {}) {
    const p = this.ctx.player;
    const w = this.ctx.world;
    const half = (w?.half ?? 180) - 6;
    const fwdYaw = Math.atan2(p.forward.x, p.forward.z);
    const fh = Math.hypot(p.forward.x, p.forward.z) || 1;
    const tries = opts.tries ?? 14;
    for (let i = 0; i < tries; i++) {
      const a = opts.behind ? fwdYaw + Math.PI + (Math.random() - 0.5) * 2.4 : Math.random() * TAU;
      const r = minD + Math.random() * (maxD - minD);
      const x = p.pos.x + Math.sin(a) * r;
      const z = p.pos.z + Math.cos(a) * r;
      if (Math.abs(x) > half || Math.abs(z) > half) continue;
      if (w?.isWater?.(x, z) || this._blocked(x, z)) continue;
      const y = w?.heightAt?.(x, z) ?? 0;
      if (opts.unseen !== false) {
        const dot = (Math.sin(a) * p.forward.x + Math.cos(a) * p.forward.z) / fh;
        if (dot > 0.45) {
          _a.set(x, y + (this.model.eyeHeight || 1.6), z);
          if (w?.lineOfSight?.(_a, p.eye)) continue;
        }
      }
      return new THREE.Vector3(x, y, z);
    }
    return null;
  }

  _blocked(x, z) {
    const near = this.ctx.world?.collidersNear?.(x, z, 2);
    if (!near) return false;
    for (let i = 0; i < near.length; i++) {
      const c = near[i];
      if (Math.hypot(c.x - x, c.z - z) < c.r + this.radius + 0.2) return true;
    }
    return false;
  }

  _advance(dx, dz, fly, skipY = false) {
    this.pos.x += dx;
    this.pos.z += dz;
    const w = this.ctx.world;
    if (!fly) w?.resolveCollision?.(this.pos, this.radius);
    else {
      const half = (w?.half ?? 180) - 2;
      this.pos.x = clamp(this.pos.x, -half, half);
      this.pos.z = clamp(this.pos.z, -half, half);
    }
    if (!skipY) this._settleY();
  }

  _settleY() {
    this.pos.y = (this.ctx.world?.heightAt?.(this.pos.x, this.pos.z) ?? 0) + this.altitude;
  }

  // ======================================================================
  // Hooks
  // ======================================================================

  /** A noise happened (rock impact, scream...). Default: remember it if within earshot. */
  onNoise(evt) {
    if (!evt?.pos || evt.source === this) return;
    if (this.distTo(evt.pos) <= (evt.radius || 0) * this.hearing) {
      this.lastHeard = { pos: evt.pos.clone(), time: this.ctx.time, kind: evt.kind };
    }
  }

  /** Another creature (the banshee) revealed the player's position. */
  onAlert(pos) {
    this.lastHeard = { pos: pos.clone(), time: this.ctx.time, kind: 'alert' };
  }

  /** Noise I heard recently and haven't dealt with (younger than maxAge seconds), else null. */
  heard(maxAge = 20) {
    const h = this.lastHeard;
    return h && this.ctx.time - h.time < maxAge ? h : null;
  }

  onSpawn() {}

  /** Stop any audio loops / restore player state (pause, death, win). Brains with loops override; think() re-creates them lazily. */
  silence() {}

  /** Default brain: wander, investigate noises, chase on sight. Brains override this entirely. */
  think(dt) {
    const p = this.ctx.player;
    if (this.canSeePlayer()) {
      this.setState('chase');
      this.startChase();
    } else if (this.state === 'chase' && this.timeSinceSeen() > 5) {
      this.setState('wander');
      this.endChase();
    }
    if (this.state === 'chase') {
      this.anim = 'run';
      const target = this.timeSinceSeen() < 1 ? p.pos : this.lastSeenPos;
      this.moveToward(target, 5.6 * this.speedMul(), dt);
      this.tryKill();
      return;
    }
    const h = this.heard(15);
    if (h) {
      this.anim = 'walk';
      if (this.moveToward(h.pos, 3, dt) < 2) this.lastHeard = null;
      return;
    }
    this.anim = 'walk';
    this.wander(dt, 1.6);
  }

  // ======================================================================
  // Driven by the manager
  // ======================================================================

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    this.stateTime += dt;
    if (!this.frozen && this.ctx.state === 'playing') {
      this.think(dt);
      this.group.rotation.y = this.yaw;
    }
    this.model.animate?.(this.anim, this.t, dt, this.speed);
  }

  dispose() {}
}
