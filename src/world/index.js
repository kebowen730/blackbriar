// BLACKBRIAR world: terrain, forest, undergrowth, water, sky, landmarks, wardstones.
// All units are meters, Y up. See docs/ARCHITECTURE.md ("World").
import * as THREE from 'three';
import { mulberry32, fbm2, noise2 } from '../core/rng.js';
import { createTerrain, HALF, EXT } from './terrain.js';
import { createSpatial } from './spatial.js';
import { makeTextures } from './textures.js';
import { buildSky, MOON_DIR } from './sky.js';
import { buildWater } from './water.js';
import { buildTrees } from './trees.js';
import { buildProps } from './props.js';
import { buildLandmarks } from './landmarks.js';
import { buildWardstones } from './wardstones.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function buildTerrainMesh(root, T, tex, seed) {
  const N = 210;
  const geo = new THREE.PlaneGeometry(EXT * 2, EXT * 2, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, T.heightAt(x, z));
    uv.setXY(i, x / 7, z / 7);
  }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;

  const cSoil = new THREE.Color(0x4a3a2c);
  const cMoss = new THREE.Color(0x2f4d2a);
  const cNeedle = new THREE.Color(0x57391f);
  const cTrail = new THREE.Color(0x6b5a46);
  const cMud = new THREE.Color(0x232420);
  const cRock = new THREE.Color(0x56585a);
  const c = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n1 = fbm2(x * 0.03 + 50, z * 0.03 - 20, seed + 3, 3);
    const n2 = noise2(x * 0.25, z * 0.25, seed + 4);
    const n3 = fbm2(x * 0.018 - 7, z * 0.018 + 3, seed + 8, 2);
    c.copy(cSoil).lerp(cMoss, smooth(0.47, 0.64, n1));
    c.lerp(cNeedle, smooth(0.42, 0.7, n3) * 0.75);
    const ny = nor.getY(i);
    c.lerp(cRock, (1 - smooth(0.82, 0.95, ny)) * 0.55);
    const wTrail = 1 - smooth(0.9, 2.5, T.trailDist(x, z));
    const wPad = 1 - smooth(0, 4, T.padDist(x, z));
    c.lerp(cTrail, Math.max(wTrail * 0.9, wPad * 0.8));
    c.lerp(cMud, (1 - smooth(0, 2.6, T.wetness(x, z))) * 0.9);
    const k = 0.82 + 0.36 * n2;
    colors[i * 3] = c.r * k;
    colors[i * 3 + 1] = c.g * k;
    colors[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();

  const mat = new THREE.MeshLambertMaterial({ map: tex.ground, vertexColors: true, color: 0xffffff });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  root.add(mesh);
  return mesh;
}

export function createWorld(ctx, { seed = 1 } = {}) {
  const scene = ctx.scene;
  const quality = ctx.settings?.quality || 'high';
  const Q = { high: 1, medium: 0.65, low: 0.4 }[quality] ?? 1;
  const rng = mulberry32(seed * 7919 + 13);

  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);

  const T = createTerrain(seed);
  const S = createSpatial(HALF, T.heightAt);
  const aniso = Math.min(8, ctx.renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
  const tex = makeTextures(aniso);
  const timeU = { value: 0 };
  const env = { root, T, S, tex, rng, Q, timeU, seed };

  // ---- atmosphere
  scene.fog = new THREE.FogExp2(0x05070b, 0.028);
  scene.background = new THREE.Color(0x05070b);
  const moon = new THREE.DirectionalLight(0x7a98e0, 0.3);
  moon.position.copy(MOON_DIR).multiplyScalar(120);
  moon.castShadow = false;
  root.add(moon);
  root.add(moon.target);
  const hemi = new THREE.HemisphereLight(0x1c2a4a, 0x0a0d0b, 0.22);
  root.add(hemi);
  const sky = buildSky(root, seed);
  sky.follow(ctx.camera);

  // ---- ground, water
  buildTerrainMesh(root, T, tex, seed);
  const water = buildWater(root, T, tex);

  // ---- structures first (they reserve space), then forest, then undergrowth
  const lm = buildLandmarks(env);
  const wd = buildWardstones(env);
  const forest = buildTrees(env);
  const props = buildProps(env);

  const hidingSpots = [...lm.hiding, ...props.hiding];

  // ---- pickups
  const g = (x, z, dy = 0.08) => new THREE.Vector3(x, T.heightAt(x, z) + dy, z);
  const walkable = (x, z, pad = 0.8) => Math.abs(x) < HALF - 4 && Math.abs(z) < HALF - 4 && !T.isWater(x, z) && T.wetness(x, z) > 1 && !S.blocked(x, z, pad);

  function randomPoint(r = rng, { minDistFrom = null, minDist = 0, avoidWater = true } = {}) {
    const lim = HALF - 5;
    for (let i = 0; i < 80; i++) {
      const x = (r() * 2 - 1) * lim;
      const z = (r() * 2 - 1) * lim;
      if (avoidWater && T.isWater(x, z)) continue;
      if (S.blocked(x, z, 0.9)) continue;
      if (minDistFrom) {
        const dx = x - minDistFrom.x;
        const dz = z - minDistFrom.z;
        if (dx * dx + dz * dz < minDist * minDist) continue;
      }
      return new THREE.Vector3(x, T.heightAt(x, z), z);
    }
    // fallback: walk a spiral out of the campsite
    for (let k = 0; k < 200; k++) {
      const a = k * 2.4;
      const d = 6 + k * 0.8;
      const x = lm.spawn.x + Math.cos(a) * d;
      const z = lm.spawn.z + Math.sin(a) * d;
      if (Math.abs(x) < lim && Math.abs(z) < lim && !T.isWater(x, z) && !S.blocked(x, z, 0.9)) return new THREE.Vector3(x, T.heightAt(x, z), z);
    }
    return lm.spawn.clone();
  }

  const pickups = { rocks: [], batteries: [], slingshot: lm.hints.slingshot.clone() };
  const placedPickups = [lm.hints.slingshot];
  const farFromPickups = (x, z, d) => placedPickups.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 > d * d);
  // batteries: landmarks first, then scattered
  for (const b of lm.hints.batteries) {
    pickups.batteries.push(b.clone());
    placedPickups.push(b);
  }
  let guard = 0;
  while (pickups.batteries.length < 14 && guard++ < 500) {
    const p = randomPoint(rng, { minDistFrom: lm.spawn, minDist: 30 });
    if (!walkable(p.x, p.z) || !farFromPickups(p.x, p.z, 25)) continue;
    p.y += 0.08;
    pickups.batteries.push(p);
    placedPickups.push(p);
  }
  // rocks: a few near the campsite, some around landmarks, rest scattered
  const rockNear = [[lm.spawn, 7, 22, 4]];
  for (const l of lm.landmarks) rockNear.push([l.pos, 5, 11, 1]);
  for (const [c, d0, d1, n] of rockNear) {
    for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 40; tries++) {
        const a = rng() * 6.283;
        const d = d0 + rng() * (d1 - d0);
        const x = c.x + Math.cos(a) * d;
        const z = c.z + Math.sin(a) * d;
        if (!walkable(x, z, 0.7) || !farFromPickups(x, z, 5)) continue;
        const p = g(x, z);
        pickups.rocks.push(p);
        placedPickups.push(p);
        break;
      }
    }
  }
  guard = 0;
  while (pickups.rocks.length < 40 && guard++ < 800) {
    const p = randomPoint(rng);
    if (!walkable(p.x, p.z, 0.7) || !farFromPickups(p.x, p.z, 9)) continue;
    p.y += 0.08;
    pickups.rocks.push(p);
    placedPickups.push(p);
  }

  // ---- wardstones come from the builder; landmarks add the pond
  const landmarks = [...lm.landmarks, { name: 'Pond', pos: new THREE.Vector3(T.pond.x, T.pond.y, T.pond.z) }];

  const lanternBase = lm.lantern?.intensity ?? 0;
  let clock = 0;

  const world = {
    half: HALF,
    root,
    heightAt: T.heightAt,
    colliders: S.colliders,
    collidersNear: (x, z, radius) => S.near(x, z, radius),
    resolveCollision: (pos, radius) => S.resolve(pos, radius),
    lineOfSight: (a, b) => S.los(a, b),
    canopyAt: forest.canopyAt,
    isWater: T.isWater,
    trees: forest.trees,
    hidingSpots,
    hidingSpotAt(pos) {
      let best = null;
      let bd = 1e9;
      for (let i = 0; i < hidingSpots.length; i++) {
        const s = hidingSpots[i];
        const dx = pos.x - s.pos.x;
        const dz = pos.z - s.pos.z;
        const d = dx * dx + dz * dz;
        if (d < s.r * s.r && d < bd && Math.abs(pos.y - s.pos.y) < 3) {
          bd = d;
          best = s;
        }
      }
      return best;
    },
    wardstones: wd.wardstones,
    pickupSpawns: pickups,
    landmarks,
    playerSpawn: lm.spawn.clone(),
    playerSpawnYaw: lm.spawnYaw,
    lights: { moon, hemi, lantern: lm.lantern },
    randomPoint,
    update(dt, c = ctx) {
      clock += dt;
      timeU.value = clock;
      water.update(clock);
      wd.update(clock);
      sky.follow(c?.camera || ctx.camera);
      if (lm.lantern) lm.lantern.intensity = lanternBase * (0.93 + 0.05 * Math.sin(clock * 7.3) * Math.sin(clock * 2.1) + 0.02 * Math.sin(clock * 19));
    },
    reset() {
      for (const w of wd.wardstones) w.reset();
    },
  };
  return world;
}
