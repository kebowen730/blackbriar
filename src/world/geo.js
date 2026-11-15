// Geometry helpers: PartBuilder merges primitives (with vertex colours) into a single BufferGeometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

export function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function lump(g, amt) {
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const l = Math.hypot(x, y, z) || 1;
    const d =
      (hash3(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)) - 0.5) * 2 * amt +
      (hash3(Math.round(x * 9), Math.round(y * 9), Math.round(z * 9)) - 0.5) * amt;
    pos.setXYZ(i, x + (x / l) * d, y + (y / l) * d, z + (z / l) * d);
  }
  g.computeVertexNormals();
}

export class PartBuilder {
  constructor() {
    this.list = [];
    this.base = null;
  }

  // run fn with every added part pre-transformed by matrix M (nestable)
  within(M, fn) {
    const prev = this.base;
    this.base = prev ? prev.clone().multiply(M) : M.clone();
    fn();
    this.base = prev;
    return this;
  }

  add(geo, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (o.lump) lump(g, o.lump);
    if (o.uv) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uv[0], uv.getY(i) * o.uv[1]);
    }
    if (o.quat) _q.copy(o.quat);
    else {
      _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
      _q.setFromEuler(_e);
    }
    _m.compose(_p.set(o.x || 0, o.y || 0, o.z || 0), _q, _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    if (this.base) _m.premultiply(this.base);
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(o.color ?? 0xffffff);
    const jit = o.jit || 0;
    const pos = g.attributes.position;
    for (let i = 0; i < n; i++) {
      let k = 1;
      if (jit) k = 1 + (hash3(Math.round(pos.getX(i) * 20), Math.round(pos.getY(i) * 20), Math.round(pos.getZ(i) * 20)) - 0.5) * jit;
      col[i * 3] = _c.r * k;
      col[i * 3 + 1] = _c.g * k;
      col[i * 3 + 2] = _c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(g);
    return this;
  }

  box(w, h, d, o) {
    return this.add(new THREE.BoxGeometry(w, h, d), o);
  }
  cyl(rt, rb, h, seg, o, open = false) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), o);
  }
  cone(r, h, seg, o) {
    return this.add(new THREE.ConeGeometry(r, h, seg), o);
  }
  sphere(r, o, ws = 7, hs = 5) {
    return this.add(new THREE.SphereGeometry(r, ws, hs), o);
  }
  ico(r, detail, o) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), o);
  }
  // triangular prism: base width w along x, height h, thickness t along z. (x,y,z) = centre of the base.
  prism(w, h, t, o = {}) {
    const r = w / 1.7320508;
    const sz = h / (1.5 * r);
    const q = new THREE.Quaternion().setFromAxisAngle(_up, o.ry || 0);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    return this.add(new THREE.CylinderGeometry(r, r, t, 3), { ...o, y: (o.y || 0) + 0.5 * r * sz, quat: q, sz });
  }
  // cylinder between two points (p0 bottom r0, p1 top r1)
  between(p0, p1, r0, r1, o = {}, seg = 6) {
    _a.set(p0[0], p0[1], p0[2]);
    _b.set(p1[0], p1[1], p1[2]);
    const dir = _b.clone().sub(_a);
    const L = dir.length();
    dir.divideScalar(L || 1);
    const q = new THREE.Quaternion().setFromUnitVectors(_up, dir);
    return this.add(new THREE.CylinderGeometry(r1, r0, L, seg, 1, false), {
      ...o,
      x: (p0[0] + p1[0]) / 2,
      y: (p0[1] + p1[1]) / 2,
      z: (p0[2] + p1[2]) / 2,
      quat: q,
      uv: o.uv || [1, Math.max(0.2, L / 2.2)],
    });
  }

  build({ project = false, k = 0.5 } = {}) {
    const g = mergeGeometries(this.list, false);
    for (const p of this.list) p.dispose();
    this.list.length = 0;
    if (project) projectUV(g, k);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// planar UV projection along the dominant normal axis (good enough for blocky props)
export function projectUV(g, k = 0.5) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ax >= ay && ax >= az) uv.setXY(i, z * k, y * k);
    else if (ay >= ax && ay >= az) uv.setXY(i, x * k, z * k);
    else uv.setXY(i, x * k, y * k);
  }
}

// Crossed alpha cards with up-facing normals and both faces emitted (so Lambert lighting is stable).
// unit width 1, unit height 1, origin at the bottom centre. bend arches the top sideways.
export function crossedCards(nQuads, bend = 0) {
  const pos = [];
  const nor = [];
  const uv = [];
  const rows = [
    [0, 0, 0],
    [0.55, bend * 0.12, 0.55],
    [1, bend * 0.5, 1],
  ];
  const push = (x, y, z, u, v) => {
    pos.push(x, y, z);
    nor.push(0, 1, 0);
    uv.push(u, v);
  };
  for (let k = 0; k < nQuads; k++) {
    const th = (k * Math.PI) / nQuads;
    const cx = Math.cos(th);
    const cz = Math.sin(th);
    // arch direction perpendicular to the card plane
    const px = -cz;
    const pz = cx;
    for (let r = 0; r < 2; r++) {
      const [y0, b0, v0] = rows[r];
      const [y1, b1, v1] = rows[r + 1];
      const w0 = 0.5 * (1 - 0.2 * r);
      const w1 = 0.5 * (1 - 0.2 * (r + 1));
      const a = [-cx * w0 + px * b0, y0, -cz * w0 + pz * b0, 0, v0];
      const b = [cx * w0 + px * b0, y0, cz * w0 + pz * b0, 1, v0];
      const c = [cx * w1 + px * b1, y1, cz * w1 + pz * b1, 1, v1];
      const d = [-cx * w1 + px * b1, y1, -cz * w1 + pz * b1, 0, v1];
      for (const t of [a, b, c, a, c, d]) push(t[0], t[1], t[2], t[3], t[4]);
      for (const t of [a, c, b, a, d, c]) push(t[0], t[1], t[2], t[3], t[4]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

const _tm = new THREE.Matrix4();
const _te = new THREE.Euler();
const _tq = new THREE.Quaternion();
// build a transform matrix (position + YXZ euler)
export function T4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  _te.set(rx, ry, rz, 'YXZ');
  _tq.setFromEuler(_te);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _tq, new THREE.Vector3(1, 1, 1));
}
