// Shared helpers for the mothman / jerseydevil / notdeer / leshy models.
import * as THREE from 'three';

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;

export function prng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// deterministic 0..1 hash of a number (used for quantised glitch noise)
export function hash1(n) {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function canvasTex(w, h, draw, repX = 1, repY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  t.anisotropy = 4;
  return t;
}

export function stdMat(color, rough = 0.92, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true, ...opts });
}
export function glowMat(color) {
  const m = new THREE.MeshBasicMaterial({ color, fog: false });
  m.toneMapped = false;
  return m;
}

// Displace vertices along their normals with cheap position-based noise (seam-safe).
export function warp(geo, amp, freq = 3, seed = 0) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = Math.sin(x * freq + seed) * Math.sin(y * freq * 1.3 + seed * 2.1) * Math.sin(z * freq * 0.9 + seed * 3.3)
      + 0.5 * Math.sin((x + y + z) * freq * 2.3 + seed);
    p.setXYZ(i, x + n.getX(i) * d * amp, y + n.getY(i) * d * amp, z + n.getZ(i) * d * amp);
  }
  geo.computeVertexNormals();
  return geo;
}
export function ellipsoid(rx, ry, rz, ws = 12, hs = 9) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

// hangs down (-Y) from its pivot; r0 at pivot
export function limbGeo(r0, r1, len, seg = 6) {
  const g = new THREE.CylinderGeometry(r0, r1, len, seg, 1);
  g.translate(0, -len / 2, 0);
  return g;
}
// rises up (+Y) from base; r0 at base
export function stalkGeo(r0, r1, len, seg = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.translate(0, len / 2, 0);
  return g;
}
// along +X from origin
export function xGeo(r0, r1, len, seg = 5) {
  const g = stalkGeo(r0, r1, len, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}
// along +Z from origin; rBack at z=0, rFront at z=len
export function zGeo(rBack, rFront, len, seg = 7) {
  const g = new THREE.CylinderGeometry(rFront, rBack, len, seg, 1);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, len / 2);
  return g;
}

export function add(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
export function pivot(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const _up = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
// tapered stick between two points (arrays) in parent's space
export function bone(parent, a, b, r0, r1, material, seg = 5) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _d.length();
  _d.normalize();
  const m = new THREE.Mesh(stalkGeo(r0, r1, len, seg), material);
  m.position.set(a[0], a[1], a[2]);
  m.quaternion.setFromUnitVectors(_up, _d);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Arbitrary polygon-soup geometry (verts flat [x,y,z..], tris flat indices, uvs flat)
export function polyGeo(verts, tris, uvs) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(tris);
  g.computeVertexNormals();
  return g;
}

// ---- tiny pose-blending rig -------------------------------------------------
// Joints hold a smoothed delta (rotation + position offset) added to the build pose.
// Each frame: rig.reset(); P(joint, ...targets); rig.apply(dt, rate).
export class Rig {
  constructor() { this.js = []; this.first = true; }
  add(obj) {
    const j = {
      o: obj, bx: obj.position.x, by: obj.position.y, bz: obj.position.z,
      rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z,
      tx: 0, ty: 0, tz: 0, px: 0, py: 0, pz: 0,
      cx: 0, cy: 0, cz: 0, qx: 0, qy: 0, qz: 0,
    };
    this.js.push(j);
    return j;
  }
  reset() {
    const a = this.js;
    for (let i = 0; i < a.length; i++) {
      const j = a[i];
      j.tx = j.ty = j.tz = j.px = j.py = j.pz = 0;
    }
  }
  apply(dt, rate = 8) {
    const k = this.first ? 1 : 1 - Math.exp(-rate * dt);
    this.first = false;
    const a = this.js;
    for (let i = 0; i < a.length; i++) {
      const j = a[i];
      j.cx += (j.tx - j.cx) * k; j.cy += (j.ty - j.cy) * k; j.cz += (j.tz - j.cz) * k;
      j.qx += (j.px - j.qx) * k; j.qy += (j.py - j.qy) * k; j.qz += (j.pz - j.qz) * k;
      const o = j.o;
      o.rotation.set(j.rx + j.cx, j.ry + j.cy, j.rz + j.cz);
      o.position.set(j.bx + j.qx, j.by + j.qy, j.bz + j.qz);
    }
  }
}
// set joint targets (rotation delta rx,ry,rz; position offset px,py,pz)
export function P(j, rx = 0, ry = 0, rz = 0, px = 0, py = 0, pz = 0) {
  j.tx = rx; j.ty = ry; j.tz = rz; j.px = px; j.py = py; j.pz = pz;
}
