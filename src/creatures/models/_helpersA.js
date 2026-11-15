// Shared helpers for the wendigo / skinwalker / dogman / rake models.
import * as THREE from 'three';

// ---------- tiny deterministic rng (models look identical every build) ----------
let _s = 1;
export function seed(n) { _s = (n >>> 0) || 1; }
export function rnd() { _s = (Math.imul(_s, 1664525) + 1013904223) >>> 0; return _s / 4294967296; }
export function rr(a, b) { return a + (b - a) * rnd(); }
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** sparse spiky twitch 0..1 (mostly 0) */
export function tw(t, f, o = 0) {
  const a = Math.sin(t * f + o) * Math.sin(t * f * 0.713 + 1.3 + o);
  return a > 0 ? Math.pow(a, 5) : 0;
}

// ---------- canvas textures (null when no DOM, e.g. node smoke tests) ----------
export function canvasTex(size, paint, rx = 1, ry = 1) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return null;
  paint(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function fillBase(g, s, col) { g.globalAlpha = 1; g.fillStyle = col; g.fillRect(0, 0, s, s); }
export function blotches(g, s, cols, n, rmin, rmax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * s, y = rnd() * s, r = rr(rmin, rmax);
    g.globalAlpha = alpha * (0.4 + 0.6 * rnd());
    g.fillStyle = cols[(rnd() * cols.length) | 0];
    for (let ox = -s; ox <= s; ox += s) {
      for (let oy = -s; oy <= s; oy += s) {
        const px = x + ox, py = y + oy;
        if (px < -r || px > s + r || py < -r || py > s + r) continue;
        g.beginPath(); g.arc(px, py, r, 0, 6.2832); g.fill();
      }
    }
  }
  g.globalAlpha = 1;
}
export function strokes(g, s, cols, n, len, w, alpha, ang = Math.PI / 2, spread = 0.5) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * s, y = rnd() * s;
    const a = ang + (rnd() - 0.5) * spread * 2;
    const L = len * (0.5 + rnd());
    g.globalAlpha = alpha * (0.4 + 0.6 * rnd());
    g.strokeStyle = cols[(rnd() * cols.length) | 0];
    g.lineWidth = w * (0.5 + rnd());
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  g.globalAlpha = 1;
}

// ---------- materials ----------
export function stdMat(o) {
  return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0, flatShading: true }, o));
}
export function eyeMat(color) {
  const m = new THREE.MeshBasicMaterial({ color });
  m.toneMapped = false;
  return m;
}

// ---------- geometry ----------
export function addColor(geo, jit = 0.22, r = 1, g = 1, b = 1) {
  const p = geo.attributes.position, n = p.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = 1 - jit * (0.5 + 0.5 * Math.sin(p.getX(i) * 61 + p.getY(i) * 43 + p.getZ(i) * 29));
    a[i * 3] = r * v; a[i * 3 + 1] = g * v; a[i * 3 + 2] = b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
}

/** Mesh helper: auto vertex colours when the material wants them, castShadow, parent may be a Joint. */
export function mk(parent, geo, mat, x = 0, y = 0, z = 0) {
  if (mat.vertexColors && !geo.attributes.color) addColor(geo);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  (parent.g || parent).add(m);
  return m;
}

/**
 * Tapered limb. Default hangs DOWN from its pivot (r0 at top, r1 at bottom);
 * o.up grows UP from the pivot (r0 base, r1 tip); o.z grows along +Z.
 * o.prof = radius multipliers per ring (hs+1 entries) for knobby joints; o.flat squashes z; o.jag = rough noise.
 */
export function limbGeo(len, r0, r1, o = {}) {
  const rs = o.rs || 6, hs = o.hs || 4, up = !!(o.up || o.z);
  const g = new THREE.CylinderGeometry(up ? r1 : r0, up ? r0 : r1, len, rs, hs);
  g.translate(0, up ? len / 2 : -len / 2, 0);
  const p = g.attributes.position, prof = o.prof, jag = o.jag || 0, fz = o.flat || 1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = clamp((up ? y : -y) / len, 0, 1);
    const k = prof ? (prof[Math.round(t * hs)] || 1) : 1;
    const j = 1 + Math.sin(x * 57 + y * 91 + z * 37) * jag;
    p.setXYZ(i, x * k * j, y, z * k * j * fz);
  }
  if (o.z) g.rotateX(Math.PI / 2);
  return g;
}

let _unitCone = null;
export function shardGeo() {
  if (!_unitCone) {
    _unitCone = new THREE.ConeGeometry(1, 1, 4, 1, true);
    _unitCone.translate(0, 0.5, 0);
  }
  return _unitCone;
}
/** cone with base at y=0, tip at +h */
export function coneGeo(r, h, seg = 5) {
  const g = new THREE.ConeGeometry(r, h, seg, 1);
  g.translate(0, h / 2, 0);
  return g;
}
/** ragged hanging strip, pivot at top, hangs down */
export function stripGeo(w, h, segs = 3) {
  const g = new THREE.PlaneGeometry(w, h, 1, segs);
  g.translate(0, -h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const t = -y / h;
    p.setXYZ(i, x * (1 - 0.65 * t) + Math.sin(y * 31 + x * 17) * 0.02 * t, y - Math.abs(Math.sin(x * 47 + y * 13)) * 0.12 * t * (t > 0.9 ? 1 : 0), Math.sin(y * 9) * 0.03 * t);
  }
  return g;
}

// ---------- geometry merger (own implementation: only 'three' import) ----------
const _o = new THREE.Object3D();
const _n3 = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

export class Merger {
  constructor(jit = 0.2) { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.jit = jit; }
  _push(geo, color) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    _n3.getNormalMatrix(_o.matrix);
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    _c.set(color);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(_o.matrix);
      this.pos.push(_v.x, _v.y, _v.z);
      const f = 1 - this.jit * (0.5 + 0.5 * Math.sin(_v.x * 61 + _v.y * 43 + _v.z * 29));
      this.col.push(_c.r * f, _c.g * f, _c.b * f);
      if (n) { _v.fromBufferAttribute(n, i).applyMatrix3(_n3).normalize(); this.nor.push(_v.x, _v.y, _v.z); } else this.nor.push(0, 1, 0);
      if (u) this.uv.push(u.getX(i), u.getY(i)); else this.uv.push(0, 0);
    }
    if (g !== geo) g.dispose();
  }
  add(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy, sz, color = 0xffffff) {
    if (sy === undefined) sy = sx;
    if (sz === undefined) sz = sx;
    _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.scale.set(sx, sy, sz); _o.quaternion.setFromEuler(_o.rotation);
    _o.updateMatrix();
    this._push(geo, color);
    return this;
  }
  /** orient geometry's +Y along (dx,dy,dz), random roll about its axis */
  addDir(geo, x, y, z, dx, dy, dz, sx = 1, sy = 1, sz = 1, color = 0xffffff, roll = 0) {
    _d.set(dx, dy, dz).normalize();
    _qa.setFromUnitVectors(_UP, _d);
    _qb.setFromAxisAngle(_UP, roll);
    _qa.multiply(_qb);
    _o.position.set(x, y, z); _o.quaternion.copy(_qa); _o.scale.set(sx, sy, sz);
    _o.updateMatrix();
    this._push(geo, color);
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** Scatter flattened shards (fur / hide / sinew) over an ellipsoid surface. */
export function shaggy(m, o) {
  const cx = o.cx || 0, cy = o.cy || 0, cz = o.cz || 0;
  const rx = o.rx || 1, ry = o.ry || 1, rz = o.rz || 1;
  const n = o.n || 20, len = o.len || 0.2, w = o.w || 0.05;
  const dx = o.dx || 0, dy = o.dy === undefined ? -1 : o.dy, dz = o.dz === undefined ? -0.3 : o.dz;
  const out = o.out === undefined ? 0.5 : o.out, spread = o.spread === undefined ? 0.35 : o.spread;
  const cols = Array.isArray(o.color) ? o.color : [o.color || 0x777777];
  const geo = shardGeo();
  const yMin = o.yMin === undefined ? -1 : o.yMin;
  for (let i = 0; i < n; i++) {
    let u = rnd() * 2 - 1;
    if (u < yMin) u = yMin + rnd() * 0.3;
    const th = rnd() * 6.2832, q = Math.sqrt(1 - u * u);
    const nx = q * Math.cos(th), ny = u, nz = q * Math.sin(th);
    const vx = nx * out + dx + (rnd() - 0.5) * spread;
    const vy = ny * out + dy + (rnd() - 0.5) * spread;
    const vz = nz * out + dz + (rnd() - 0.5) * spread;
    const L = len * (0.55 + 0.9 * rnd());
    m.addDir(geo, cx + nx * rx * 0.94, cy + ny * ry * 0.94, cz + nz * rz * 0.94, vx, vy, vz, w * (0.7 + 0.6 * rnd()), L, w * 0.3, cols[(rnd() * cols.length) | 0], rnd() * 3.14);
  }
}

export function eyeMesh(parent, mat, r, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  (parent.g || parent).add(m);
  return m;
}

// ---------- pose rig: targets are lerped every frame (no snapping between anims) ----------
export class Joint {
  constructor(g) {
    this.g = g;
    this.tx = g.rotation.x; this.ty = g.rotation.y; this.tz = g.rotation.z;
    this.px = g.position.x; this.py = g.position.y; this.pz = g.position.z;
  }
  r(x, y, z) { this.tx = x; this.ty = y; this.tz = z; return this; }
  p(x, y, z) { this.px = x; this.py = y; this.pz = z; return this; }
}
export class Rig {
  constructor() { this.list = []; this.first = true; }
  add(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    (parent.g || parent).add(g);
    const j = new Joint(g);
    this.list.push(j);
    return j;
  }
  step(dt, rate = 10) {
    const k = this.first ? 1 : 1 - Math.exp(-rate * dt);
    this.first = false;
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const j = L[i], r = j.g.rotation, p = j.g.position;
      r.x += (j.tx - r.x) * k; r.y += (j.ty - r.y) * k; r.z += (j.tz - r.z) * k;
      p.x += (j.px - p.x) * k; p.y += (j.py - p.y) * k; p.z += (j.pz - p.z) * k;
    }
  }
}
