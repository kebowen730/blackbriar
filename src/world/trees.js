// Instanced pine + dead trees, split into grid chunks that frustum-cull independently.
import * as THREE from 'three';
import { fbm2, mulberry32 } from '../core/rng.js';
import { PartBuilder } from './geo.js';
import { HALF } from './terrain.js';

const PINE_H = 15.4;
const DEAD_H = 10.6;
const CHUNK = 60;

function makePineFoliage(rng, layers, seg) {
  const pos = [];
  const col = [];
  const uvs = [];
  const tri = (a, b, c, ca, cb, cc) => {
    for (const p of [a, b, c]) pos.push(p[0], p[1], p[2]);
    for (const k of [ca, cb, cc]) col.push(k, k, k);
    uvs.push(a[0] * 0.22 + a[1] * 0.1, a[2] * 0.22 + a[1] * 0.18, b[0] * 0.22 + b[1] * 0.1, b[2] * 0.22 + b[1] * 0.18, c[0] * 0.22 + c[1] * 0.1, c[2] * 0.22 + c[1] * 0.18);
  };
  for (let l = 0; l < layers; l++) {
    const f = l / (layers - 1);
    const yb = 3.9 + 8.5 * Math.pow(f, 0.95);
    const hgt = 3.1 - 1.2 * f;
    const R = 2.8 - 2.05 * f;
    const apex = [0, yb + hgt, 0];
    const mid = [];
    const edge = [];
    const lip = [];
    const jitterA = rng() * 6.28;
    for (let j = 0; j < seg; j++) {
      const a = jitterA + ((j + (rng() - 0.5) * 0.5) / seg) * Math.PI * 2;
      const rj = R * (0.78 + rng() * 0.4);
      const s = Math.sin(a);
      const c = Math.cos(a);
      mid.push([s * rj * 0.55, yb + hgt * 0.42 + (rng() - 0.5) * 0.2, c * rj * 0.55]);
      edge.push([s * rj, yb + (rng() - 0.5) * 0.25, c * rj]);
      lip.push([s * rj * 0.8, yb - 0.55 - rng() * 0.35 * (1 - f * 0.5), c * rj * 0.8]);
    }
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg;
      tri(apex, mid[j], mid[k], 1.0, 0.82, 0.82);
      // mid -> edge
      tri(mid[j], edge[j], edge[k], 0.82, 0.92, 0.92);
      tri(mid[j], edge[k], mid[k], 0.82, 0.92, 0.82);
      // edge -> lip
      tri(edge[j], lip[j], lip[k], 0.92, 0.55, 0.55);
      tri(edge[j], lip[k], edge[k], 0.92, 0.55, 0.92);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  // fatten normals upward a little so needles read as soft volume under the flashlight
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i);
    const y = n.getY(i) * 0.7 + 0.25;
    const z = n.getZ(i);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i, x / l, y / l, z / l);
  }
  g.computeBoundingSphere();
  return g;
}

function makeDeadTree(rng) {
  const pb = new PartBuilder();
  const bark = 0xffffff;
  const pts = [
    [0, -0.4, 0],
    [0.18, 3.6, 0.12],
    [-0.12, 7.2, 0.25],
    [0.12, DEAD_H, -0.05],
  ];
  const rads = [0.36, 0.26, 0.15, 0.03];
  for (let i = 0; i < 3; i++) pb.between(pts[i], pts[i + 1], rads[i], rads[i + 1], { color: bark, jit: 0.15 }, 6);
  const lerpPt = (y) => {
    for (let i = 0; i < 3; i++) {
      if (y <= pts[i + 1][1]) {
        const t = (y - pts[i][1]) / (pts[i + 1][1] - pts[i][1]);
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, y, pts[i][2] + (pts[i + 1][2] - pts[i][2]) * t];
      }
    }
    return pts[3];
  };
  const nb = 10;
  for (let i = 0; i < nb; i++) {
    const y = 2.4 + (i / nb) * 7 + rng() * 0.5;
    const o = lerpPt(y);
    const az = i * 2.4 + rng() * 1.2;
    const el = 0.25 + rng() * 0.9;
    const len = (2.6 - y * 0.15) * (0.7 + rng() * 0.6);
    const d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
    const mid = [o[0] + d[0] * len * 0.55, o[1] + d[1] * len * 0.55 + 0.15, o[2] + d[2] * len * 0.55];
    const end = [o[0] + d[0] * len, o[1] + d[1] * len + 0.5, o[2] + d[2] * len];
    const r0 = 0.1 + (10.6 - y) * 0.008;
    pb.between(o, mid, r0, r0 * 0.6, { color: bark, jit: 0.2 }, 5);
    pb.between(mid, end, r0 * 0.6, 0.02, { color: bark, jit: 0.2 }, 5);
    // fork
    const az2 = az + (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.6);
    const fl = len * 0.5;
    pb.between(
      mid,
      [mid[0] + Math.cos(az2) * fl * 0.8, mid[1] + fl * 0.6, mid[2] + Math.sin(az2) * fl * 0.8],
      r0 * 0.5,
      0.015,
      { color: bark },
      4
    );
  }
  return pb.build();
}

export function buildTrees(env) {
  const { root, T, S, tex, rng, Q } = env;
  const sd = env.seed;

  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.42, PINE_H, Q < 0.5 ? 5 : 7, 1);
  trunkGeo.translate(0, PINE_H / 2 - 0.4, 0);
  {
    const uv = trunkGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.5, uv.getY(i) * 7);
  }
  const frng = mulberry32(sd * 5 + 1);
  const foliageGeo = makePineFoliage(frng, Q < 0.5 ? 5 : 6, Q < 0.5 ? 7 : 8);
  const deadGeo = makeDeadTree(mulberry32(sd * 5 + 2));

  const trunkMat = new THREE.MeshLambertMaterial({ map: tex.bark, color: 0xffffff });
  const foliageMat = new THREE.MeshLambertMaterial({ map: tex.needle, vertexColors: true, side: THREE.DoubleSide, color: 0x6f7f72 });

  // ---- candidate placement
  const target = Math.round(1400 * Q);
  const cell = Math.sqrt((HALF * 2 * HALF * 2) / (target * 1.5));
  const cand = [];
  for (let gx = -HALF + 2; gx < HALF - 2; gx += cell) {
    for (let gz = -HALF + 2; gz < HALF - 2; gz += cell) {
      const x = gx + rng() * cell;
      const z = gz + rng() * cell;
      if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) continue;
      const n = fbm2(x * 0.021 + 5, z * 0.021 - 9, sd + 21, 3);
      if (n < 0.4 && rng() < 0.6) continue;
      if (T.clearAt(x, z)) continue;
      cand.push([x, z]);
    }
  }
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  cand.length = Math.min(cand.length, target);

  const trees = [];
  const entries = []; // {x,y,z,kind,sy,sxz,yaw,tx,tz,tint}
  const tint = new THREE.Color();
  const mkEntry = (x, z, kind, ring) => {
    const dead = kind === 'dead';
    const h = dead ? 7 + rng() * 5 : ring ? 16 + rng() * 8 : 11 + rng() * 9.5;
    const sy = h / (dead ? DEAD_H : PINE_H);
    const sxz = (0.85 + rng() * 0.38) * (0.75 + 0.25 * sy) * (ring ? 1.2 : 1);
    const y = T.heightAt(x, z) - 0.05;
    const rad = (dead ? 0.36 : 0.42) * sxz * 0.82 + 0.04;
    const v = dead ? 0.55 + rng() * 0.35 : 0.7 + rng() * 0.5;
    tint.setRGB(v * (0.92 + rng() * 0.1), v * (0.95 + rng() * 0.08), v * (dead ? 0.95 : 1.0 + rng() * 0.1));
    entries.push({
      x,
      y,
      z,
      kind,
      sy,
      sxz,
      yaw: rng() * 6.283,
      tx: (rng() - 0.5) * 0.09,
      tz: (rng() - 0.5) * 0.09,
      r: tint.r,
      g: tint.g,
      b: tint.b,
    });
    if (!ring) {
      trees.push({ x, z, height: h, radius: rad, kind: dead ? 'dead' : 'pine' });
      S.add(x, z, rad, y, h);
    }
  };
  for (const [x, z] of cand) mkEntry(x, z, rng() < 0.15 ? 'dead' : 'pine', false);

  // dense outer skirt so the edge of the world never shows
  const ringCell = 10 / Math.sqrt(Q);
  for (let x = -HALF - 40; x < HALF + 40; x += ringCell) {
    for (let z = -HALF - 40; z < HALF + 40; z += ringCell) {
      const px = x + rng() * ringCell;
      const pz = z + rng() * ringCell;
      if (Math.abs(px) < HALF + 1 && Math.abs(pz) < HALF + 1) continue;
      if (Math.abs(px) > HALF + 36 || Math.abs(pz) > HALF + 36) continue;
      mkEntry(px, pz, 'pine', true);
    }
  }

  // ---- chunking
  const chunks = new Map();
  for (const e of entries) {
    const k = Math.floor((e.x + 300) / CHUNK) + ',' + Math.floor((e.z + 300) / CHUNK);
    let c = chunks.get(k);
    if (!c) chunks.set(k, (c = { pine: [], dead: [] }));
    (e.kind === 'dead' ? c.dead : c.pine).push(e);
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  const group = new THREE.Group();
  group.name = 'trees';

  const setAll = (mesh, list) => {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      eu.set(e.tx, e.yaw, e.tz, 'YXZ');
      q.setFromEuler(eu);
      m4.compose(p.set(e.x, e.y, e.z), q, sc.set(e.sxz, e.sy, e.sxz));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col.setRGB(e.r, e.g, e.b));
    }
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius += 1;
    mesh.frustumCulled = true;
  };

  for (const c of chunks.values()) {
    if (c.pine.length) {
      const tm = new THREE.InstancedMesh(trunkGeo, trunkMat, c.pine.length);
      setAll(tm, c.pine);
      tm.castShadow = true;
      tm.receiveShadow = true;
      group.add(tm);
      const fm = new THREE.InstancedMesh(foliageGeo, foliageMat, c.pine.length);
      setAll(fm, c.pine);
      fm.castShadow = true;
      fm.receiveShadow = false;
      group.add(fm);
    }
    if (c.dead.length) {
      const dm = new THREE.InstancedMesh(deadGeo, trunkMat, c.dead.length);
      setAll(dm, c.dead);
      dm.castShadow = true;
      dm.receiveShadow = true;
      group.add(dm);
    }
  }
  root.add(group);

  // ---- canopy cover grid (3 m cells) from tall pines
  const CC = 3;
  const CO = -200;
  const CN = 134;
  const canopy = new Float32Array(CN * CN);
  for (const e of entries) {
    if (e.kind !== 'pine') continue;
    const R = 3.4 * e.sxz;
    const x0 = Math.max(0, Math.floor((e.x - R - CO) / CC));
    const x1 = Math.min(CN - 1, Math.floor((e.x + R - CO) / CC));
    const z0 = Math.max(0, Math.floor((e.z - R - CO) / CC));
    const z1 = Math.min(CN - 1, Math.floor((e.z + R - CO) / CC));
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const dx = CO + (ix + 0.5) * CC - e.x;
        const dz = CO + (iz + 0.5) * CC - e.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < R) canopy[iz * CN + ix] += 0.7 * (1 - d / R) + 0.3;
      }
    }
  }
  function canopyAt(x, z) {
    const ix = Math.floor((x - CO) / CC);
    const iz = Math.floor((z - CO) / CC);
    if (ix < 0 || iz < 0 || ix >= CN || iz >= CN) return 1;
    const v = canopy[iz * CN + ix];
    return v > 1 ? 1 : v;
  }

  return { trees, canopyAt, group };
}
