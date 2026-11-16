// BLACKBRIAR — bootstrap, main loop, run state machine, objectives.

import * as THREE from 'three';
import { createBus } from './core/bus.js';
import { mulberry32 } from './core/rng.js';
import { createWorld } from './world/index.js';
import { createPlayer } from './player/index.js';
import { createItems } from './player/items.js';
import { createCreatureManager } from './creatures/manager.js';
import { createAudio } from './audio/index.js';
import { createUI } from './ui/index.js';
import { createFX } from './fx/index.js';

const DIFFICULTY = {
  easy: { mul: 0.86, grace: 35 },
  normal: { mul: 1.0, grace: 24 },
  hard: { mul: 1.12, grace: 14 },
};
// Absolute render scale in CSS pixels (never above the display's own ratio).
const PIXEL_RATIO = { low: 0.75, medium: 1.15, high: 1.75 };
const WARD_HOLD_SECONDS = 3.2;
const WARD_REACH = 2.8;

function loadSettings() {
  const s = { quality: 'medium', sensitivity: 1, volume: 0.8 };
  try {
    Object.assign(s, JSON.parse(localStorage.getItem('blackbriar.settings') || '{}') || {});
  } catch {
    /* ignore */
  }
  if (!PIXEL_RATIO[s.quality]) s.quality = 'medium';
  return s;
}

// ---------------------------------------------------------------------------
// Renderer / scene
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 260);
scene.add(camera);

const ctx = {
  scene,
  camera,
  renderer,
  bus: createBus(),
  rng: mulberry32((Math.random() * 2 ** 31) | 0),
  state: 'menu',
  time: 0,
  frame: 0,
  aggression: 0,
  difficultyMul: 1,
  graceTime: 14,
  settings: loadSettings(),
};
window.__blackbriar = ctx; // debugging handle

function applyRendererSize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const want = PIXEL_RATIO[ctx.settings.quality] ?? 1.15;
  renderer.setPixelRatio(Math.min(want, Math.max(window.devicePixelRatio || 1, 0.75)));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  ctx.fx?.resize?.(w, h);
}
applyRendererSize();

// Subsystems. Order matters: world first (others read it), UI/FX last.
ctx.audio = createAudio(ctx);
ctx.world = createWorld(ctx, { seed: 7 });
ctx.player = createPlayer(ctx);
ctx.items = createItems(ctx);
ctx.creatures = createCreatureManager(ctx);
ctx.fx = createFX(ctx);
ctx.ui = createUI(ctx);
applyRendererSize();

const { bus, world, player, items, creatures, audio, ui, fx } = ctx;

// Dawn: a light that only exists for the win sequence.
const dawnLight = new THREE.AmbientLight(0xffd9b0, 0);
scene.add(dawnLight);
const nightFog = scene.fog ? { color: scene.fog.color.clone(), density: scene.fog.density } : null;
const nightBackground = scene.background?.isColor ? scene.background.clone() : null;
const DAWN_COLOR = new THREE.Color(0x6f7f8f);
let dawn = 0; // 0..1
let dawnTarget = 0;

function applyDawn() {
  dawnLight.intensity = dawn * 1.6;
  if (nightFog && scene.fog) {
    scene.fog.color.copy(nightFog.color).lerp(DAWN_COLOR, dawn);
    scene.fog.density = nightFog.density * (1 - 0.55 * dawn);
  }
  if (nightBackground && scene.background?.isColor) scene.background.copy(nightBackground).lerp(DAWN_COLOR, dawn);
  world.setDawn?.(dawn);
}

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

const run = {
  ids: [],
  difficulty: 'normal',
  lit: 0,
  holdTime: 0,
  holdTarget: null,
  lastStinger: -99,
  hints: [],
  wasLocked: false,
};

const stats = () => ({ time: ctx.time, wardstones: run.lit, identified: creatures.identified.size });
const totalWards = () => world.wardstones?.length || 5;

function startRun(ids, difficulty) {
  run.ids = ids?.length ? [...ids] : run.ids;
  run.difficulty = DIFFICULTY[difficulty] ? difficulty : run.difficulty;
  const diff = DIFFICULTY[run.difficulty];
  ctx.difficultyMul = diff.mul;
  ctx.graceTime = diff.grace;
  ctx.time = 0;
  ctx.aggression = 0;
  run.lit = 0;
  run.holdTime = 0;
  run.holdTarget = null;
  run.lastStinger = -99;
  dawn = 0;
  dawnTarget = 0;
  applyDawn();

  world.reset?.();
  player.reset(world.playerSpawn, world.playerSpawnYaw ?? 0);
  items.reset?.();
  creatures.identified.clear();
  creatures.spawn(run.ids);
  fx.reset?.();
  if (!player.flashlight.on) player.flashlight.toggle?.();

  ctx.state = 'playing';
  dropFocus();
  player.enabled = true;
  ui.hideCreatureCard?.();
  ui.hidePause?.();
  ui.showHUD();
  ui.setPrompt(null);
  ui.setProgress(null);
  ui.setObjective(`Wardstones 0 / ${totalWards()}`);
  audio.resume?.();
  audio.setAmbience?.(true);
  audio.setTension?.(0);
  if (player.viewModel?.group) player.viewModel.group.visible = true;
  acquireLock();

  run.hints = [
    [2.5, 'Wake the five wardstones to bring the dawn. The compass marks them.'],
    [9, 'F — flashlight.  Light shows you what hunts you. It also shows you to them.'],
    [17, 'You cannot fight. Run, crouch in the brush with your light off, or throw a rock.'],
  ];
}

function toMenu() {
  ctx.state = 'menu';
  player.enabled = false;
  player.unlock?.();
  creatures.clear();
  audio.resume?.(); // leaving the pause screen: don't leave the context suspended
  audio.setTension?.(0);
  // The player/flashlight don't update in the menu: darken the beam and hide the arm explicitly.
  player.flashlight?.reset?.();
  if (player.viewModel?.group) player.viewModel.group.visible = false;
  fx.reset?.();
  fx.setFear?.(0);
  dawn = 0;
  dawnTarget = 0;
  applyDawn();
  world.reset?.();
  ui.hideHUD?.();
  ui.hidePause?.();
  ui.hideCreatureCard?.();
  ui.showMenu();
}

function pause() {
  if (ctx.state !== 'playing') return;
  ctx.state = 'paused';
  player.enabled = false;
  audio.suspend?.();
  ui.showPause();
}

function resume() {
  if (ctx.state !== 'paused') return;
  ctx.state = 'playing';
  dropFocus();
  player.enabled = true;
  audio.resume?.();
  ui.hidePause();
  acquireLock();
}

// Request pointer lock for play. If the browser refuses (Chrome rejects new locks for about a
// second after an Esc exit), fall back to the pause menu rather than running with a free cursor.
function lockFailed() {
  if (ctx.state === 'playing' && document.pointerLockElement !== canvas) pause();
}
function acquireLock() {
  const p = player.lock?.();
  if (p && typeof p.then === 'function') p.then((ok) => ok === false && lockFailed());
}

function win() {
  ctx.state = 'won';
  player.enabled = false;
  dawnTarget = 1;
  audio.setTension?.(0);
  fx.setFear?.(0);
  creatures.silence?.();
  audio.play?.('wardstone_all');
  for (const c of creatures.list) c.frozen = true;
  ui.setPrompt(null);
  ui.setProgress(null);
  ui.hideCreatureCard?.();
  const s = stats();
  setTimeout(() => {
    if (ctx.state !== 'won') return;
    player.unlock?.();
    ui.showWin(s);
  }, 4200);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

// Menu buttons keep keyboard focus after a click, so Space or Enter during play would
// "click" them again. Only accept each event from the screen that owns its button.
bus.on('ui:start', ({ creatureIds, difficulty } = {}) => {
  if (ctx.state === 'menu') startRun(creatureIds, difficulty);
});
bus.on('ui:restart', () => {
  if (ctx.state === 'dead' || ctx.state === 'won' || ctx.state === 'paused') startRun(run.ids, run.difficulty);
});
bus.on('ui:menu', () => {
  if (ctx.state === 'dead' || ctx.state === 'won' || ctx.state === 'paused') toMenu();
});
bus.on('ui:resume', resume);

const dropFocus = () => {
  const el = document.activeElement;
  if (el && el !== document.body) el.blur?.();
};
const PLAY_KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener(
  'keydown',
  (e) => {
    if ((ctx.state === 'playing' || ctx.state === 'dying') && PLAY_KEYS.has(e.code)) e.preventDefault();
  },
  true,
);

bus.on('ui:settings', (s = {}) => {
  if (s.quality && PIXEL_RATIO[s.quality]) ctx.settings.quality = s.quality;
  if (typeof s.sensitivity === 'number') ctx.settings.sensitivity = s.sensitivity;
  if (typeof s.volume === 'number') {
    ctx.settings.volume = s.volume;
    audio.setMaster?.(s.volume);
  }
  if (s.quality) {
    fx.setQuality?.(ctx.settings.quality);
    applyRendererSize();
  }
});

bus.on('creature:focus', (f) => {
  if (f) {
    if (ctx.state === 'playing') ui.showCreatureCard(f.def, { firstTime: !!f.firstTime });
  } else ui.hideCreatureCard();
});

bus.on('creature:identified', ({ id }) => {
  ui.markIdentified?.(id);
  audio.play?.('identify');
});

bus.on('creature:alert', () => {
  if (ctx.state !== 'playing') return;
  if (ctx.time - run.lastStinger < 7) return;
  run.lastStinger = ctx.time;
  audio.play?.('stinger', { volume: 0.9 });
  fx.pulse?.(0.35);
});

bus.on('player:died', ({ creature, def } = {}) => {
  if (ctx.state !== 'playing') return;
  ctx.state = 'dying';
  player.enabled = false;
  ui.setPrompt(null);
  ui.setProgress(null);
  ui.hideCreatureCard?.();
  ui.hideHUD?.();
  const s = stats();
  const done = () => {
    if (ctx.state !== 'dying') return;
    ctx.state = 'dead';
    player.unlock?.();
    creatures.silence?.();
    audio.setTension?.(0);
    fx.setFear?.(0);
    ui.showDeath(def || creature?.def, s);
  };
  // Safety net first, so a throwing or silent jumpscare can never leave the game in 'dying'.
  setTimeout(done, 4000);
  try {
    if (fx.jumpscare) fx.jumpscare(creature, done);
    else done();
  } catch (err) {
    console.error('[main] jumpscare threw', err);
    done();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && run.wasLocked && ctx.state === 'playing') pause();
  // Esc during a pending request pauses first; if the lock is then granted, give it back.
  if (locked && ctx.state !== 'playing') player.unlock?.();
  run.wasLocked = locked;
});
document.addEventListener('pointerlockerror', lockFailed);
canvas.addEventListener('click', () => {
  if (ctx.state !== 'paused') audio.resume?.();
  if (ctx.state === 'playing' && document.pointerLockElement !== canvas) acquireLock();
});
window.addEventListener('keydown', (e) => {
  // Esc without pointer lock (lock denied / never acquired) still pauses.
  if (e.code === 'Escape' && ctx.state === 'playing' && document.pointerLockElement !== canvas) pause();
});
window.addEventListener('blur', () => {
  if (ctx.state === 'playing') pause();
});
window.addEventListener('resize', applyRendererSize);

// ---------------------------------------------------------------------------
// Wardstones
// ---------------------------------------------------------------------------

function updateWardstones(dt) {
  const stones = world.wardstones || [];
  let near = null;
  let nearD = WARD_REACH;
  for (const s of stones) {
    if (s.lit) continue;
    const d = Math.hypot(s.pos.x - player.pos.x, s.pos.z - player.pos.z);
    if (d < nearD) {
      nearD = d;
      near = s;
    }
  }
  if (!near) {
    if (run.holdTarget) {
      ui.setPrompt(null);
      ui.setProgress(null);
    }
    run.holdTarget = null;
    run.holdTime = 0;
    return;
  }
  if (run.holdTarget !== near) {
    run.holdTarget = near;
    run.holdTime = 0;
    ui.setPrompt('Hold E — wake the wardstone');
  }
  if (player.input?.interact) {
    run.holdTime += dt;
    ui.setProgress(Math.min(1, run.holdTime / WARD_HOLD_SECONDS));
  } else if (run.holdTime > 0) {
    run.holdTime = Math.max(0, run.holdTime - dt * 2);
    ui.setProgress(run.holdTime > 0 ? run.holdTime / WARD_HOLD_SECONDS : null);
  }
  if (run.holdTime >= WARD_HOLD_SECONDS) {
    near.light();
    near.lit = true;
    run.lit += 1;
    run.holdTarget = null;
    run.holdTime = 0;
    const total = totalWards();
    ctx.aggression = run.lit / total;
    ui.setPrompt(null);
    ui.setProgress(null);
    ui.setObjective(`Wardstones ${run.lit} / ${total}`);
    audio.play?.('wardstone', { pos: near.pos });
    fx.pulse?.(0.25);
    bus.emit('wardstone:lit', { index: stones.indexOf(near), lit: run.lit, total });
    // The light and the sound carry. Everything nearby comes to look.
    bus.emit('noise', { pos: near.pos.clone(), radius: 70, kind: 'wardstone' });
    if (run.lit >= total) win();
    else ui.toast(run.lit === total - 1 ? 'One stone left. They know.' : 'The stone wakes. Something heard it.', 4);
  }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

let lastFrameAt = performance.now();
let menuAngle = Math.random() * Math.PI * 2;
const _look = new THREE.Vector3();

function menuCamera(dt) {
  const c = world.playerSpawn || _look.set(0, 0, 0);
  menuAngle += dt * 0.035;
  const r = 9;
  const x = c.x + Math.sin(menuAngle) * r;
  const z = c.z + Math.cos(menuAngle) * r;
  camera.position.set(x, (world.heightAt?.(x, z) ?? 0) + 2.1, z);
  camera.lookAt(_look.set(c.x, (world.heightAt?.(c.x, c.z) ?? 0) + 1.1, c.z));
}

function safe(label, fn) {
  try {
    fn();
  } catch (err) {
    if (!safe.seen.has(label)) {
      safe.seen.add(label);
      console.error(`[main] ${label} threw`, err);
    }
  }
}
safe.seen = new Set();

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min((now - lastFrameAt) / 1000, 0.05);
  lastFrameAt = now;
  tick(dt);
}

// Debug: advance the game without requestAnimationFrame (hidden tabs don't fire it).
ctx.debugStep = (dt = 1 / 30, n = 1) => {
  for (let i = 0; i < n; i++) tick(dt);
};

function tick(dt) {
  ctx.frame++;
  const s = ctx.state;

  if (s === 'playing') {
    ctx.time += dt;
    safe('player.update', () => player.update(dt));
    safe('items.update', () => items.update(dt));
    safe('creatures.update', () => creatures.update(dt));
    if (ctx.state === 'playing') safe('wardstones', () => updateWardstones(dt));
    while (run.hints.length && ctx.time >= run.hints[0][0]) ui.toast(run.hints.shift()[1], 5.5);
    const tension = creatures.tension || 0;
    audio.setTension?.(tension);
    fx.setFear?.(tension);
  } else if (s === 'dying' || s === 'won') {
    safe('player.update', () => player.update(dt));
    safe('creatures.update', () => creatures.update(dt));
  } else if (s === 'menu') {
    menuCamera(dt);
  }

  if (dawn !== dawnTarget) {
    dawn += Math.sign(dawnTarget - dawn) * Math.min(Math.abs(dawnTarget - dawn), dt / 4);
    applyDawn();
  }

  if (s !== 'paused') safe('world.update', () => world.update?.(dt, ctx));
  safe('audio.update', () => audio.update?.(dt));
  safe('ui.update', () => ui.update?.(dt));
  safe('fx.update', () => fx.update?.(dt));
  if (fx.render) safe('fx.render', () => fx.render(dt));
  else renderer.render(scene, camera);
}

ui.showMenu();
frame();
