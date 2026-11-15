// Spawns creatures, routes noises to them, tracks the player's scent trail and handles
// flashlight identification.
//
// Brains and models are discovered by file name, so a missing file degrades to the
// default brain / a placeholder model instead of breaking the build.

import * as THREE from 'three';
import { Creature } from './base.js';
import { CREATURE_BY_ID } from '../data/creatures.js';

const brainModules = import.meta.glob('./brains/*.js', { eager: true });
const modelModules = import.meta.glob('./models/*.js', { eager: true });

const fileId = (path) => path.split('/').pop().replace('.js', '');
const BRAINS = {};
const MODELS = {};
for (const [path, mod] of Object.entries(brainModules)) if (mod.default) BRAINS[fileId(path)] = mod.default;
for (const [path, mod] of Object.entries(modelModules)) if (mod.build) MODELS[fileId(path)] = mod.build;

function placeholderModel() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 1.3, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 1 }),
  );
  body.position.y = 1;
  body.castShadow = true;
  group.add(body);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
    eye.position.set(0.1 * s, 1.75, 0.3);
    group.add(eye);
  }
  return { group, height: 2, eyeHeight: 1.75, animate() {} };
}

// The flashlight is harsh at close range, so pale creatures blow out to pure white.
// Knock their albedo down once at build time; emissive eyes are untouched.
function grime(model, k = 0.5) {
  const seen = new Set();
  model.group.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (seen.has(m) || !m.isMeshStandardMaterial) continue;
      seen.add(m);
      m.color.multiplyScalar(k);
      if (m.roughness < 0.7) m.roughness = 0.7;
    }
  });
  return model;
}

const GRIME = { rake: 0.3, wendigo: 0.4, skinwalker: 0.3, dogman: 0.3, nightcrawler: 0.42, llorona: 0.45, notdeer: 0.6, leshy: 0.8, mothman: 0.8, flatwoods: 0.8, banshee: 0.7 };

const TRAIL_SPACING = 2.5;
const TRAIL_MAX = 260;
const IDENTIFY_TIME = 0.45; // seconds of continuous light needed
const FOCUS_RANGE = 30;
const FOCUS_LINGER = 3.5;

export function createCreatureManager(ctx) {
  const mgr = {
    list: [],
    /** Player breadcrumbs, oldest first: [{ pos: Vector3, time }]. The Wendigo follows these. */
    trail: [],
    identified: new Set(),
    /** 0..1 — how threatened the player currently is (drives heartbeat / fear FX). */
    tension: 0,
    nearest: null,
    nearestDist: Infinity,
    focus: null,

    spawn(ids) {
      mgr.clear();
      const world = ctx.world;
      const player = ctx.player;
      for (const id of ids) {
        const def = CREATURE_BY_ID[id];
        if (!def) continue;
        let model;
        try {
          model = MODELS[id] ? grime(MODELS[id](), GRIME[id] ?? 0.5) : placeholderModel();
        } catch (err) {
          console.error(`[creatures] model "${id}" failed to build`, err);
          model = placeholderModel();
        }
        const Brain = BRAINS[id] || Creature;
        let c;
        try {
          c = new Brain(ctx, def, model);
        } catch (err) {
          console.error(`[creatures] brain "${id}" failed to construct`, err);
          c = new Creature(ctx, def, model);
        }
        const at =
          world?.randomPoint?.(ctx.rng, { minDistFrom: player?.pos, minDist: 75 }) ||
          new THREE.Vector3(60 + Math.random() * 40, 0, 60 + Math.random() * 40);
        c.pos.set(at.x, at.y, at.z);
        c.yaw = Math.random() * Math.PI * 2;
        c._litTime = 0;
        ctx.scene.add(c.group);
        mgr.list.push(c);
        try {
          c.onSpawn();
        } catch (err) {
          console.error(`[creatures] ${id}.onSpawn threw`, err);
        }
        c._settleY();
      }
    },

    clear() {
      for (const c of mgr.list) {
        try {
          c.dispose();
        } catch (err) {
          console.error(err);
        }
        ctx.scene.remove(c.group);
      }
      mgr.list.length = 0;
      mgr.trail.length = 0;
      mgr.tension = 0;
      mgr.nearest = null;
      mgr.nearestDist = Infinity;
      mgr._lingerUntil = 0;
      if (mgr.focus) {
        mgr.focus = null;
        ctx.bus.emit('creature:focus', null);
      }
    },

    /** Tell every creature (except `source`) where the player is. */
    alertAll(pos, source = null) {
      for (const c of mgr.list) {
        if (c === source) continue;
        try {
          c.onAlert(pos);
        } catch (err) {
          console.error(err);
        }
      }
    },

    get(id) {
      return mgr.list.find((c) => c.id === id) || null;
    },

    update(dt) {
      const player = ctx.player;
      if (!player) return;

      // --- scent trail ------------------------------------------------------
      if (ctx.state === 'playing') {
        const last = mgr.trail[mgr.trail.length - 1];
        if (!last || last.pos.distanceTo(player.pos) > TRAIL_SPACING) {
          mgr.trail.push({ pos: player.pos.clone(), time: ctx.time });
          if (mgr.trail.length > TRAIL_MAX) mgr.trail.shift();
        }
      }

      // --- think + animate --------------------------------------------------
      let tension = 0;
      let nearest = null;
      let nearestDist = Infinity;
      let lit = null;
      let litDist = Infinity;
      for (const c of mgr.list) {
        try {
          c.update(dt);
        } catch (err) {
          if (!c._errored) console.error(`[creatures] ${c.id}.think threw`, err);
          c._errored = true;
        }
        const d = c.distToPlayer();
        if (d < nearestDist) {
          nearestDist = d;
          nearest = c;
        }
        const t = c.chasing ? 0.45 + 0.55 * (1 - Math.min(d, 45) / 45) : 0.7 * (1 - Math.min(d, 28) / 28);
        if (t > tension) tension = t;

        if (ctx.state === 'playing' && d < FOCUS_RANGE && c.group.visible && c.isLit()) {
          c._litTime += dt;
          if (d < litDist) {
            litDist = d;
            lit = c;
          }
        } else {
          c._litTime = 0;
        }
      }
      mgr.nearest = nearest;
      mgr.nearestDist = nearestDist;
      mgr.tension += (tension - mgr.tension) * Math.min(1, dt * (tension > mgr.tension ? 4 : 0.6));

      // --- flashlight identification ---------------------------------------
      if (lit && lit._litTime >= IDENTIFY_TIME) {
        const firstTime = !mgr.identified.has(lit.id);
        if (firstTime) {
          mgr.identified.add(lit.id);
          ctx.bus.emit('creature:identified', { id: lit.id, def: lit.def });
        }
        if (mgr.focus !== lit) {
          mgr.focus = lit;
          ctx.bus.emit('creature:focus', { id: lit.id, def: lit.def, creature: lit, firstTime });
        }
        mgr._lingerUntil = ctx.time + FOCUS_LINGER;
      } else if (mgr.focus && ctx.time > (mgr._lingerUntil || 0)) {
        mgr.focus = null;
        ctx.bus.emit('creature:focus', null);
      }
    },
  };

  ctx.bus.on('noise', (evt) => {
    for (const c of mgr.list) {
      try {
        c.onNoise(evt);
      } catch (err) {
        console.error(err);
      }
    }
  });

  return mgr;
}
