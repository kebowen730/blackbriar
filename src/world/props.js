// Undergrowth: bushes (hiding), tall grass (hiding), ferns, boulders (colliders), hollow logs (hiding).
import * as THREE from 'three';
import { PartBuilder, crossedCards } from './geo.js';
import { fbm2 } from '../core/rng.js';

function cardMaterial(map, timeU, amp) {
  const m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.45, color: 0xffffff });
  const a = amp.toFixed(3);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader =
      'uniform float uTime;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 wpS = instanceMatrix * vec4(transformed, 1.0);
        #else
          vec4 wpS = vec4(transformed, 1.0);
        #endif
        float swPh = wpS.x * 0.31 + wpS.z * 0.23;
        float swH = uv.y * uv.y;
        transformed.x += (sin(uTime * 1.7 + swPh) * 0.6 + sin(uTime * 3.1 + swPh * 1.7) * 0.25) * ${a} * swH;
        transformed.z += cos(uTime * 1.3 + swPh * 0.8) * ${a} * 0.6 * swH;`
      );
  };
  m.customProgramCacheKey = () => 'bbsway' + a;
  return m;
}

export function buildProps(env) {
  const { root, T, S, tex, rng, Q, timeU } = env;
  const group = new THREE.Group();
  group.name = 'props';
  const hiding = [];

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();

  const finishInst = (mesh, pad = 0.5) => {
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius += pad;
  };

  // generic accept-test for a prop position
  const okSpot = (x, z, rad, o = {}) => {
    if (Math.abs(x) > 176 || Math.abs(z) > 176) return false;
    if (T.wetness(x, z) < (o.water ?? 1.5)) return false;
    if (T.padDist(x, z) < (o.pad ?? 2)) return false;
    if (T.trailDist(x, z) < (o.trail ?? 1.8)) return false;
    if (S.blocked(x, z, rad)) return false;
    return true;
  };
  const farFrom = (list, x, z, d) => {
    for (const s of list) {
      const dx = s.pos.x - x;
      const dz = s.pos.z - z;
      if (dx * dx + dz * dz < d * d) return false;
    }
    return true;
  };

  // ---------------- bushes (brambles) ----------------
  {
    const pb = new PartBuilder();
    const blobs = [
      [0, 0.62, 0, 0.95, 0x203a1f],
      [0.62, 0.5, 0.2, 0.7, 0x2b4527],
      [-0.58, 0.52, -0.18, 0.72, 0x24401f],
      [0.12, 0.55, -0.6, 0.66, 0x2f3d24],
      [-0.1, 0.5, 0.62, 0.68, 0x3b2a2e],
      [0.05, 1.0, 0.02, 0.6, 0x2a4a2a],
    ];
    for (const [x, y, z, r, c] of blobs) pb.ico(r, 1, { x, y: y, z, color: c, lump: r * 0.28, jit: 0.35, sy: 0.88 });
    // thorny canes poking out
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283 + rng();
      const l = 0.9 + rng() * 0.6;
      const y0 = 0.2 + rng() * 0.6;
      pb.between([Math.cos(a) * 0.3, y0, Math.sin(a) * 0.3], [Math.cos(a) * (0.3 + l), y0 + 0.2 + rng() * 0.7, Math.sin(a) * (0.3 + l)], 0.035, 0.012, { color: 0x4b3a33 }, 4);
    }
    const geo = pb.build();
    const mat = new THREE.MeshLambertMaterial({ map: tex.leaf, vertexColors: true, color: 0xffffff });
    const count = 40;
    const placed = [];
    let tries = 0;
    while (placed.length < count && tries++ < 4000) {
      const x = (rng() * 2 - 1) * 170;
      const z = (rng() * 2 - 1) * 170;
      const s = 1.15 + rng() * 0.6;
      if (!okSpot(x, z, s * 1.1)) continue;
      if (!farFrom(placed.map((a) => ({ pos: a })), x, z, 9)) continue;
      placed.push({ x, z, s, y: T.heightAt(x, z), yaw: rng() * 6.28, sy: 0.9 + rng() * 0.35 });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, placed.length);
    placed.forEach((b, i) => {
      eu.set(0, b.yaw, 0);
      q.setFromEuler(eu);
      m4.compose(p.set(b.x, b.y - 0.1, b.z), q, sc.set(b.s, b.s * b.sy, b.s));
      mesh.setMatrixAt(i, m4);
      const v = 0.8 + rng() * 0.35;
      mesh.setColorAt(i, col.setRGB(v, v * (0.95 + rng() * 0.1), v));
      hiding.push({ id: 'bush_' + i, type: 'bush', pos: new THREE.Vector3(b.x, b.y, b.z), r: b.s * 1.0 });
    });
    finishInst(mesh, 1.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ---------------- tall grass patches (hiding) ----------------
  {
    const geo = crossedCards(2, 0.25);
    const mat = cardMaterial(tex.grass, timeU, 0.16);
    const patches = [];
    let tries = 0;
    const nP = 15;
    while (patches.length < nP && tries++ < 4000) {
      const x = (rng() * 2 - 1) * 168;
      const z = (rng() * 2 - 1) * 168;
      if (!okSpot(x, z, 2.2, { water: 2.5 })) continue;
      if (!farFrom(patches, x, z, 14)) continue;
      if (!farFrom(hiding, x, z, 6)) continue;
      patches.push({ pos: new THREE.Vector3(x, T.heightAt(x, z), z) });
    }
    const per = Math.round(34 * Math.max(0.6, Q));
    const mesh = new THREE.InstancedMesh(geo, mat, patches.length * per);
    let k = 0;
    patches.forEach((pt, i) => {
      for (let j = 0; j < per; j++) {
        const a = rng() * 6.283;
        const d = Math.sqrt(rng()) * 2.1;
        const x = pt.pos.x + Math.cos(a) * d;
        const z = pt.pos.z + Math.sin(a) * d;
        const h = 1.55 + rng() * 0.55;
        const w = 1.1 + rng() * 0.7;
        eu.set(0, rng() * 6.28, 0);
        q.setFromEuler(eu);
        m4.compose(p.set(x, T.heightAt(x, z) - 0.05, z), q, sc.set(w, h, w));
        mesh.setMatrixAt(k, m4);
        const v = 0.75 + rng() * 0.45;
        mesh.setColorAt(k, col.setRGB(v, v, v * 0.9));
        k++;
      }
      hiding.push({ id: 'grass_' + i, type: 'grass', pos: pt.pos, r: 2.0 });
    });
    finishInst(mesh, 1.5);
    mesh.frustumCulled = true;
    group.add(mesh);
  }

  // ---------------- ferns ----------------
  {
    const geo = crossedCards(3, 0.9);
    const mat = cardMaterial(tex.fern, timeU, 0.06);
    const want = Math.round(760 * Q);
    const list = [];
    let tries = 0;
    while (list.length < want && tries++ < want * 6) {
      const x = (rng() * 2 - 1) * 176;
      const z = (rng() * 2 - 1) * 176;
      const n = fbm2(x * 0.05 + 3, z * 0.05 + 8, 77, 2);
      if (n < 0.45 && rng() < 0.85) continue;
      if (T.wetness(x, z) < 0.5 || T.trailDist(x, z) < 1.3 || T.padDist(x, z) < 1) continue;
      if (S.blocked(x, z, 0.3)) continue;
      list.push([x, z]);
    }
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, z], i) => {
      const s = 0.65 + rng() * 0.6;
      eu.set(0, rng() * 6.28, 0);
      q.setFromEuler(eu);
      m4.compose(p.set(x, T.heightAt(x, z) - 0.03, z), q, sc.set(s * 1.5, s * 0.9, s * 1.5));
      mesh.setMatrixAt(i, m4);
      const v = 0.7 + rng() * 0.5;
      mesh.setColorAt(i, col.setRGB(v, v, v));
    });
    finishInst(mesh, 1);
    group.add(mesh);
  }

  // ---------------- boulders ----------------
  {
    const pb = new PartBuilder();
    pb.ico(1, 2, { lump: 0.22, color: 0xffffff, jit: 0.3, uv: [2, 2] });
    const geo = pb.build();
    const mat = new THREE.MeshLambertMaterial({ map: tex.rock, vertexColors: true, color: 0x8a8a8a });
    const want = Math.round(90 * Math.max(0.55, Q));
    const list = [];
    let tries = 0;
    while (list.length < want && tries++ < 3000) {
      let x;
      let z;
      if (list.length > 10 && rng() < 0.35) {
        const b = list[(rng() * list.length) | 0];
        const a = rng() * 6.28;
        x = b.x + Math.cos(a) * (b.s + 0.8 + rng() * 1.5);
        z = b.z + Math.sin(a) * (b.s + 0.8 + rng() * 1.5);
      } else {
        x = (rng() * 2 - 1) * 175;
        z = (rng() * 2 - 1) * 175;
      }
      const s = 0.55 + Math.pow(rng(), 2) * 1.7;
      if (!okSpot(x, z, s * 0.9, { trail: s + 1.2, pad: 3, water: 1.5 })) continue;
      list.push({ x, z, s });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((b, i) => {
      const y = T.heightAt(b.x, b.z);
      const sy = b.s * (0.6 + rng() * 0.35);
      eu.set((rng() - 0.5) * 0.4, rng() * 6.28, (rng() - 0.5) * 0.4, 'YXZ');
      q.setFromEuler(eu);
      m4.compose(p.set(b.x, y + sy * 0.35, b.z), q, sc.set(b.s * (0.9 + rng() * 0.3), sy, b.s * (0.9 + rng() * 0.3)));
      mesh.setMatrixAt(i, m4);
      const v = 0.6 + rng() * 0.45;
      mesh.setColorAt(i, col.setRGB(v, v * 1.02, v * 1.04));
      S.add(b.x, b.z, b.s * 0.88, y, sy * 1.3);
    });
    finishInst(mesh, 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ---------------- hollow logs (hiding) ----------------
  {
    const pb = new PartBuilder();
    pb.cyl(0.55, 0.62, 4.8, 10, { rz: Math.PI / 2, color: 0xffffff, jit: 0.2, uv: [3, 2] }, true);
    // broken branch stubs
    pb.between([-0.6, 0.45, 0.2], [-0.9, 0.95, 0.45], 0.09, 0.04, { color: 0xffffff }, 4);
    pb.between([1.2, 0.5, -0.3], [1.5, 0.95, -0.55], 0.08, 0.035, { color: 0xffffff }, 4);
    const geo = pb.build();
    const mat = new THREE.MeshLambertMaterial({ map: tex.bark, vertexColors: true, side: THREE.DoubleSide, color: 0xd8d0c8 });
    const list = [];
    let tries = 0;
    while (list.length < 10 && tries++ < 3000) {
      const x = (rng() * 2 - 1) * 170;
      const z = (rng() * 2 - 1) * 170;
      if (!okSpot(x, z, 2.6, { water: 2 })) continue;
      if (!farFrom(hiding, x, z, 7)) continue;
      // reasonably flat
      const y = T.heightAt(x, z);
      if (Math.abs(T.heightAt(x + 2.4, z) - y) > 0.5 || Math.abs(T.heightAt(x, z + 2.4) - y) > 0.5) continue;
      list.push({ x, z, y, yaw: rng() * 6.28 });
      hiding.push({ id: 'log_' + (list.length - 1), type: 'log', pos: new THREE.Vector3(x, y, z), r: 1.7 });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((l, i) => {
      eu.set(0, l.yaw, 0);
      q.setFromEuler(eu);
      m4.compose(p.set(l.x, l.y + 0.42, l.z), q, sc.set(1, 1, 1));
      mesh.setMatrixAt(i, m4);
      const v = 0.8 + rng() * 0.3;
      mesh.setColorAt(i, col.setRGB(v, v, v));
    });
    finishInst(mesh, 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  root.add(group);
  return { hiding, group };
}
