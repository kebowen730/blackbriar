// Five carved menhirs in rings of smaller stones. Unlit: dark stone, faint rune glint. Lit: blazing cyan-white runes.
import * as THREE from 'three';
import { PartBuilder, hash3 } from './geo.js';
import { runeTexture } from './textures.js';

function menhirGeometry(seed) {
  const g = new THREE.BoxGeometry(1.15, 3.0, 0.85, 4, 14, 4);
  g.translate(0, 1.5, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const t = y / 3.0;
    const taper = 1 - 0.22 * t;
    x *= taper;
    z *= taper;
    // weathered bulges (position-hashed so duplicated face verts stay welded)
    const k = Math.round(x * 40) + seed * 13;
    const n1 = hash3(k, Math.round(y * 40), Math.round(z * 40)) - 0.5;
    const n2 = hash3(Math.round(x * 8) + seed, Math.round(y * 8), Math.round(z * 8)) - 0.5;
    const edge = Math.min(1, Math.abs(y - 1.5) < 1.45 ? 1 : 0.2);
    x += (n1 * 0.05 + n2 * 0.12) * edge;
    z += (n1 * 0.05 + n2 * 0.1) * edge;
    // slanted broken top
    if (t > 0.88) y -= (x / 0.55 + 0.6) * 0.14 * ((t - 0.88) / 0.12);
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export function buildWardstones(env, THREEctx) {
  const { root, T, S, tex, rng } = env;
  const group = new THREE.Group();
  group.name = 'wardstones';

  const ringMat = new THREE.MeshLambertMaterial({ map: tex.rock, vertexColors: true, color: 0x7d7d7d });
  const glowMat = new THREE.MeshBasicMaterial({
    map: tex.glow,
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const glowGeo = new THREE.CircleGeometry(3.4, 24);
  glowGeo.rotateX(-Math.PI / 2);

  // Shared pool of 2 point lights for the lit stones nearest the camera. They always exist in the scene
  // (intensity 0 when unused, never .visible-toggled) so lighting a stone never recompiles shaders.
  const POOL = 2;
  const FADE_IN = 3; // 1/s
  const FADE_OUT = 2.5;
  const pool = [];
  for (let i = 0; i < POOL; i++) {
    const light = new THREE.PointLight(0xaaeeff, 0, 17, 2);
    group.add(light);
    pool.push({ light, stone: null, fade: 0 });
  }
  const list = [];
  const sites = T.layout.wards;
  sites.forEach((cfg, idx) => {
    const gy = T.heightAt(cfg.x, cfg.z);
    const pos = new THREE.Vector3(cfg.x, gy, cfg.z);
    const yaw = rng() * Math.PI * 2;

    // menhir
    const runes = runeTexture(idx + 1);
    const mat = new THREE.MeshStandardMaterial({
      map: tex.rock,
      color: 0x44474c,
      roughness: 0.95,
      metalness: 0.0,
      emissive: 0xb4f4ff,
      emissiveMap: runes,
      emissiveIntensity: 0.05,
    });
    const stone = new THREE.Mesh(menhirGeometry(idx), mat);
    stone.position.copy(pos);
    stone.position.y -= 0.12;
    stone.rotation.y = yaw;
    stone.scale.setScalar(0.92 + rng() * 0.12);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
    S.add(cfg.x, cfg.z, 0.72, gy, 3.2);

    // ring of smaller stones
    const pb = new PartBuilder();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.3;
      const d = 3.0 + rng() * 0.8;
      const sx = cfg.x + Math.cos(a) * d;
      const sz = cfg.z + Math.sin(a) * d;
      const h = 0.6 + rng() * 0.7;
      const w = 0.32 + rng() * 0.2;
      const y = T.heightAt(sx, sz) - gy;
      pb.ico(1, 1, {
        x: sx - cfg.x,
        y: y + h * 0.4,
        z: sz - cfg.z,
        sx: w,
        sy: h,
        sz: w * (0.8 + rng() * 0.4),
        ry: rng() * 6.28,
        rx: (rng() - 0.5) * 0.25,
        lump: 0.16,
        color: 0xffffff,
        jit: 0.4,
        uv: [1.5, 1.5],
      });
      S.add(sx, sz, w * 0.95, T.heightAt(sx, sz), h * 1.2);
    }
    const ring = new THREE.Mesh(pb.build(), ringMat);
    ring.position.set(cfg.x, gy, cfg.z);
    ring.castShadow = true;
    ring.receiveShadow = true;
    group.add(ring);

    // glow disc (point lights come from the shared pool below)
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(cfg.x, gy + 0.06, cfg.z);
    glow.visible = false;
    glow.renderOrder = 2;
    group.add(glow);
    const ws = {
      id: 'ward' + idx,
      pos,
      lit: false,
      phase: rng() * 10,
      light() {
        if (ws.lit) return;
        ws.lit = true;
        glow.visible = true;
        mat.emissiveIntensity = 2.4;
      },
      reset() {
        ws.lit = false;
        glow.visible = false;
        mat.emissiveIntensity = 0.05;
        for (const pl of pool) {
          if (pl.stone === ws) {
            pl.stone = null;
            pl.fade = 0;
            pl.light.intensity = 0;
          }
        }
      },
      _mat: mat,
    };
    list.push(ws);
  });

  root.add(group);

  const wantScratch = [null, null];
  const dScratch = [0, 0];

  function update(t, dt = 1 / 60, cam = null) {
    // flicker + emissive
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      const p = w.phase;
      if (w.lit) {
        const f = 0.86 + 0.09 * Math.sin(t * 9.1 + p) * Math.sin(t * 2.3 + p * 1.7) + 0.05 * Math.sin(t * 23.0 + p * 3.1);
        w._f = f;
        w._mat.emissiveIntensity = 2.4 * (0.9 + 0.1 * f);
      } else {
        w._mat.emissiveIntensity = 0.05 + 0.025 * Math.sin(t * 0.7 + p) * Math.sin(t * 0.31 + p * 2.0);
      }
    }
    glowMat.opacity = 0.5 + 0.12 * Math.sin(t * 1.7);

    // the POOL lit stones nearest the camera (no allocation)
    wantScratch[0] = wantScratch[1] = null;
    dScratch[0] = dScratch[1] = Infinity;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (!w.lit) continue;
      const d = cam ? (w.pos.x - cam.x) ** 2 + (w.pos.z - cam.z) ** 2 : i;
      if (d < dScratch[0]) {
        wantScratch[1] = wantScratch[0];
        dScratch[1] = dScratch[0];
        wantScratch[0] = w;
        dScratch[0] = d;
      } else if (d < dScratch[1]) {
        wantScratch[1] = w;
        dScratch[1] = d;
      }
    }
    // keep lights already on a wanted stone; the rest fade out
    for (let k = 0; k < POOL; k++) {
      const pl = pool[k];
      if (pl.stone && pl.stone.lit && (pl.stone === wantScratch[0] || pl.stone === wantScratch[1])) {
        pl.keep = true;
      } else {
        pl.keep = false;
        pl.fade = Math.max(0, pl.fade - FADE_OUT * dt);
        if (pl.fade <= 0) pl.stone = null;
      }
    }
    // hand idle (fully faded) lights to wanted stones that have none
    for (let n = 0; n < POOL; n++) {
      const w = wantScratch[n];
      if (!w || pool[0].stone === w || pool[1].stone === w) continue;
      for (let k = 0; k < POOL; k++) {
        const pl = pool[k];
        if (pl.stone === null) {
          pl.stone = w;
          pl.fade = 0;
          pl.light.position.set(w.pos.x, w.pos.y + 2.2, w.pos.z);
          pl.keep = true;
          break;
        }
      }
    }
    for (let k = 0; k < POOL; k++) {
      const pl = pool[k];
      if (pl.keep && pl.stone) pl.fade = Math.min(1, pl.fade + FADE_IN * dt);
      pl.light.intensity = pl.stone ? 14 * (pl.stone._f || 0.86) * pl.fade : 0;
    }
  }

  return { wardstones: list, update, group, lights: pool.map((p) => p.light) };
}
