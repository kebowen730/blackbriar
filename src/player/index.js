// Player: pointer-lock look, movement, stamina, noise, flashlight, view-model.
import * as THREE from 'three';
import { createFlashlight } from './flashlight.js';
import { createViewModel } from './viewmodel.js';

const WALK = 3.4;
const SPRINT = 6.4;
const CROUCH = 1.6;
const EYE_STAND = 1.68;
const EYE_CROUCH = 0.95;
const RADIUS = 0.35;
const TWO_PI = Math.PI * 2;
const STAMINA_MIN = 0.02; // sprint needs more than this; at or below it the player is exhausted

export function createPlayer(ctx) {
  const dom = ctx.renderer?.domElement;
  const cam = ctx.camera;
  cam.rotation.order = 'YXZ';
  if (ctx.scene && !cam.parent) ctx.scene.add(cam);

  const keys = Object.create(null);
  let crouchToggle = false;
  let yaw = 0;
  let pitch = 0;
  let eyeH = EYE_STAND;
  let stepCount = 0; // continuous step counter (1 = one footstep)
  let lastStep = 0;
  let bobAmp = 0;
  let exhausted = false;
  let staminaDelay = 0;
  let breathT = 0;
  let clock = 0;
  let prevX = 0;
  let prevZ = 0;
  let inWater = false;

  const _wish = new THREE.Vector3();
  const _prev = new THREE.Vector3();
  const _right = new THREE.Vector3();

  const player = {
    pos: new THREE.Vector3(),
    eye: new THREE.Vector3(0, EYE_STAND, 0),
    forward: new THREE.Vector3(0, 0, 1),
    yaw: 0,
    pitch: 0,
    velocity: new THREE.Vector3(),
    speed: 0,
    isMoving: false,
    isSprinting: false,
    isCrouching: false,
    stamina: 1,
    noiseRadius: 0,
    hidden: false,
    hidingSpot: null,
    alive: true,
    enabled: false,
    input: { interact: false },
    flashlight: null,
    inventory: { rocks: 3, batteries: 1, hasSlingshot: false },
    viewModel: null,
    inWater: false,
  };

  player.flashlight = createFlashlight(ctx, player);
  player.viewModel = createViewModel(ctx, player);
  cam.add(player.viewModel.group);

  // ---------------------------------------------------------------- input
  const clearKeys = () => {
    for (const k in keys) keys[k] = false;
    player.input.interact = false;
  };

  window.addEventListener('keydown', (e) => {
    if (!player.enabled || !player.alive) return;
    // Arrow Up/Down scroll the journal while it is open; they must not walk the player.
    if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && ctx.ui?.journalOpen) return;
    keys[e.code] = true;
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyF':
        player.flashlight.toggle();
        break;
      case 'KeyR':
        player.flashlight.reload();
        break;
      case 'KeyC':
        crouchToggle = !crouchToggle;
        break;
      case 'KeyE':
        player.input.interact = true;
        break;
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'KeyE') player.input.interact = false;
  });
  window.addEventListener('blur', clearKeys);

  document.addEventListener('mousemove', (e) => {
    if (!player.enabled || !player.alive) return;
    if (dom && document.pointerLockElement !== dom) return;
    let mx = e.movementX || 0;
    let my = e.movementY || 0;
    if (Math.abs(mx) > 240 || Math.abs(my) > 240) return; // browser glitch spikes
    const s = 0.0022 * (ctx.settings?.sensitivity ?? 1);
    yaw -= mx * s;
    pitch -= my * s;
    pitch = Math.max(-1.5, Math.min(1.5, pitch));
    if (yaw > Math.PI) yaw -= TWO_PI;
    else if (yaw < -Math.PI) yaw += TWO_PI;
  });

  // ---------------------------------------------------------------- helpers
  function syncCameraInfo() {
    const cp = Math.cos(pitch);
    player.forward.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp);
    player.yaw = yaw;
    player.pitch = pitch;
  }

  function footstep(vol) {
    const o = { volume: vol };
    ctx.audio?.play(player.isCrouching ? 'footstep_crouch' : 'footstep', o);
  }

  // ---------------------------------------------------------------- API
  // Returns a Promise<boolean>: false when the browser refused the lock (rejected promise or a
  // synchronous throw). Browsers without a promise-returning requestPointerLock resolve true;
  // they report refusal through the document 'pointerlockerror' event instead.
  player.lock = () => {
    try {
      const p = dom?.requestPointerLock?.();
      if (p && typeof p.then === 'function') return p.then(() => true, () => false);
      return Promise.resolve(!!dom?.requestPointerLock);
    } catch (e) {
      return Promise.resolve(false);
    }
  };
  player.unlock = () => {
    try {
      document.exitPointerLock?.();
    } catch (e) {
      /* ignore */
    }
  };

  player.kill = (creature) => {
    if (!player.alive) return;
    player.alive = false;
    player.enabled = false;
    player.velocity.set(0, 0, 0);
    player.speed = 0;
    player.isMoving = player.isSprinting = false;
    clearKeys();
    ctx.bus?.emit('player:died', { creature, id: creature?.id, def: creature?.def });
  };

  player.reset = (spawnPos, spawnYaw) => {
    const w = ctx.world;
    const p = spawnPos || w?.playerSpawn;
    if (p) player.pos.copy(p);
    if (!p) player.pos.set(0, 0, 0);
    if (w?.heightAt) player.pos.y = w.heightAt(player.pos.x, player.pos.z);
    yaw = spawnYaw ?? w?.playerSpawnYaw ?? 0;
    pitch = 0;
    player.velocity.set(0, 0, 0);
    player.speed = 0;
    player.isMoving = player.isSprinting = player.isCrouching = false;
    player.stamina = 1;
    player.noiseRadius = 0;
    player.hidden = false;
    player.hidingSpot = null;
    player.alive = true;
    player.enabled = true;
    player.inWater = false;
    exhausted = false;
    staminaDelay = 0;
    crouchToggle = false;
    eyeH = EYE_STAND;
    stepCount = lastStep = 0;
    bobAmp = 0;
    clearKeys();
    player.inventory.rocks = 3;
    player.inventory.batteries = 1;
    player.inventory.hasSlingshot = false;
    player.flashlight.reset();
    player.viewModel.reset();
    cam.position.set(player.pos.x, player.pos.y + eyeH, player.pos.z);
    cam.rotation.set(pitch, yaw + Math.PI, 0);
    player.eye.copy(cam.position);
    syncCameraInfo();
  };

  player.update = (dt) => {
    dt = Math.min(Math.max(dt, 0), 0.1);
    clock += dt;
    const w = ctx.world;
    const active = player.enabled && player.alive;
    const fl = player.flashlight;

    if (active) {
      // ---- intent
      // Drop any arrow state held from before the journal opened, so nothing is stuck on close.
      if (ctx.ui?.journalOpen) keys.ArrowUp = keys.ArrowDown = false;
      const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const hasInput = fwd !== 0 || str !== 0;
      const shift = keys.ShiftLeft || keys.ShiftRight;
      const ctrl = false; // Ctrl is not bound: Ctrl+W would close the browser tab mid-run

      let wantSprint = !!shift && fwd > 0 && !exhausted && player.stamina > STAMINA_MIN;
      if (wantSprint) crouchToggle = false;
      const crouching = !wantSprint && (ctrl || crouchToggle);
      player.isCrouching = crouching;

      inWater = !!w?.isWater?.(player.pos.x, player.pos.z);
      player.inWater = inWater;

      let maxSpeed = crouching ? CROUCH : wantSprint ? SPRINT : WALK;
      if (fwd < 0 && !wantSprint) maxSpeed *= 0.8;
      if (inWater) maxSpeed *= 0.62;

      // wish direction (forward = (sin yaw, cos yaw), right = (-cos yaw, sin yaw))
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);
      _wish.set(sy * fwd - cy * str, 0, cy * fwd + sy * str);
      if (hasInput) _wish.normalize().multiplyScalar(maxSpeed);

      // ---- accelerate
      const v = player.velocity;
      const dx = _wish.x - v.x;
      const dz = _wish.z - v.z;
      const dl = Math.hypot(dx, dz);
      const accel = hasInput ? 16 : 20;
      const step = accel * dt;
      if (dl <= step) {
        v.x = _wish.x;
        v.z = _wish.z;
      } else {
        v.x += (dx / dl) * step;
        v.z += (dz / dl) * step;
      }
      v.y = 0;

      // ---- move
      _prev.copy(player.pos);
      player.pos.x += v.x * dt;
      player.pos.z += v.z * dt;
      w?.resolveCollision?.(player.pos, RADIUS);
      const gh = w?.heightAt ? w.heightAt(player.pos.x, player.pos.z) : 0;
      player.pos.y += (gh - player.pos.y) * Math.min(1, dt * 22);
      if (!w?.heightAt) player.pos.y = 0;

      const moved = Math.hypot(player.pos.x - _prev.x, player.pos.z - _prev.z) / Math.max(dt, 1e-5);
      player.speed = Math.min(moved, Math.hypot(v.x, v.z));
      player.isMoving = player.speed > 0.35;
      player.isSprinting = wantSprint && player.isMoving;

      // ---- stamina
      if (player.isSprinting) {
        player.stamina = Math.max(0, player.stamina - dt / 7);
        staminaDelay = 1.2;
        if (player.stamina <= STAMINA_MIN) {
          exhausted = true;
          breathT = 0;
        }
      } else {
        if (staminaDelay > 0) staminaDelay -= dt;
        else player.stamina = Math.min(1, player.stamina + dt / (exhausted ? 9 : 4.5));
        if (exhausted && player.stamina >= 0.3) exhausted = false;
      }
      if (exhausted) {
        breathT -= dt;
        if (breathT <= 0) {
          breathT = 2.4;
          ctx.audio?.play('breath', { volume: 0.9 });
        }
      }

      // ---- footsteps / bob
      if (player.isMoving) {
        const rate = player.isSprinting ? 0.5 : crouching ? 0.62 : 0.55;
        stepCount += player.speed * rate * dt;
        const whole = Math.floor(stepCount);
        if (whole !== lastStep) {
          lastStep = whole;
          let vol = player.isSprinting ? 0.85 : crouching ? 0.22 : 0.5;
          if (inWater) vol *= 1.5;
          footstep(vol);
        }
      }
      bobAmp += ((player.isMoving ? 1 : 0) - bobAmp) * Math.min(1, dt * 7);

      // ---- noise
      let nTarget = 0;
      if (player.isMoving) nTarget = player.isSprinting ? 26 : crouching ? 3 : 10;
      if (inWater && nTarget > 0) nTarget *= 1.4;
      player.noiseRadius += (nTarget - player.noiseRadius) * Math.min(1, dt * 6);
      if (player.noiseRadius < 0.05 && nTarget === 0) player.noiseRadius = 0;

      // ---- hiding
      const spot = w?.hidingSpotAt ? w.hidingSpotAt(player.pos) : null;
      player.hidingSpot = spot || null;
      player.hidden = !!(spot && crouching && !fl.on);

      // ---- camera
      eyeH += ((crouching ? EYE_CROUCH : EYE_STAND) - eyeH) * Math.min(1, dt * 8);
      const sp = Math.min(1.5, player.speed / WALK);
      const ph = stepCount * TWO_PI;
      const bobY = Math.cos(ph) * 0.028 * sp * bobAmp;
      const bobX = Math.sin(ph * 0.5) * 0.02 * sp * bobAmp;
      const breathe = Math.sin(clock * 1.25) * 0.004;
      const sy2 = Math.sin(yaw);
      const cy2 = Math.cos(yaw);
      // right vector = (-cos, 0, sin)
      cam.position.set(
        player.pos.x - cy2 * bobX,
        player.pos.y + eyeH + bobY + breathe,
        player.pos.z + sy2 * bobX
      );
      const roll = Math.sin(ph * 0.5) * 0.006 * sp * bobAmp + Math.sin(clock * 0.7) * 0.0015;
      const nod = Math.cos(ph) * 0.004 * sp * bobAmp;
      cam.rotation.set(pitch + nod, yaw + Math.PI, roll);
      player.eye.copy(cam.position);
      syncCameraInfo();
    } else {
      // disabled: FX / menus may drive the camera
      player.velocity.set(0, 0, 0);
      player.speed = 0;
      player.isMoving = player.isSprinting = false;
      player.noiseRadius += (0 - player.noiseRadius) * Math.min(1, dt * 6);
      cam.getWorldPosition(player.eye);
      cam.getWorldDirection(player.forward);
      if (player.alive) {
        player.stamina = Math.min(1, player.stamina + dt / 6);
      }
    }

    fl.update(dt);
    player.viewModel.update(dt, {
      speed: player.speed,
      phase: stepCount,
      sprint: player.isSprinting,
      crouch: player.isCrouching,
      on: fl.on,
      mul: fl.multiplier,
    });
  };

  // initial placement (main calls reset() when a run starts)
  const w0 = ctx.world;
  if (w0?.playerSpawn) player.pos.copy(w0.playerSpawn);
  yaw = w0?.playerSpawnYaw ?? 0;
  syncCameraInfo();
  return player;
}
