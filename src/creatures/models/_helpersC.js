// Shared helpers for the nightcrawler / banshee / flatwoods / llorona models.
import * as THREE from 'three';

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

export function mk(geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  return m;
}

// Cylinder hanging down from the origin (top at y=0, bottom at y=-len).
export function taperGeo(rTop, rBot, len, radial = 8) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, radial, 1, false);
  g.translate(0, -len / 2, 0);
  return g;
}

export function sphereGeo(r, w = 12, h = 8) {
  return new THREE.SphereGeometry(r, w, h);
}

export function ellipsoid(mat, rx, ry, rz, cast = true, w = 14, h = 10) {
  const m = mk(new THREE.SphereGeometry(1, w, h), mat, cast);
  m.scale.set(rx, ry, rz);
  return m;
}

// ---- pose blending (no per-frame allocation) ----
export function makePose(defaults) {
  const keys = Object.keys(defaults);
  return { keys, def: defaults, cur: Object.assign({}, defaults), tgt: Object.assign({}, defaults) };
}
export function applySpec(p, spec) {
  for (let i = 0; i < p.keys.length; i++) {
    const k = p.keys[i];
    const v = spec[k];
    p.tgt[k] = v !== undefined ? v : p.def[k];
  }
}
export function stepPose(p, dt, k = 4) {
  const f = 1 - Math.exp(-k * dt);
  for (let i = 0; i < p.keys.length; i++) {
    const key = p.keys[i];
    p.cur[key] += (p.tgt[key] - p.cur[key]) * f;
  }
}

// ---- vertex-animated hanging strips (cloth / hair) ----
// strips: [{x,y,z, ox,oz (outward dir, normalised), hw (half width), len, flare, seed}]
export function makeStripSet(strips, segs = 6) {
  const n = strips.length;
  const vps = (segs + 1) * 2;
  const pos = new Float32Array(n * vps * 3);
  const nor = new Float32Array(n * vps * 3);
  const uv = new Float32Array(n * vps * 2);
  const W = new Float32Array(n * vps);
  const SD = new Float32Array(n * vps);
  const idx = [];
  let v = 0;
  for (let si = 0; si < n; si++) {
    const s0 = strips[si];
    const tx = -s0.oz, tz = s0.ox;
    const first = v;
    for (let j = 0; j <= segs; j++) {
      const s = j / segs;
      const cx = s0.x + s0.ox * s0.flare * s * s;
      const cy = s0.y - s0.len * s;
      const cz = s0.z + s0.oz * s0.flare * s * s;
      const hw = s0.hw * (1 - 0.92 * Math.pow(s, 1.6));
      for (let side = -1; side <= 1; side += 2) {
        pos[v * 3] = cx + tx * hw * side;
        pos[v * 3 + 1] = cy;
        pos[v * 3 + 2] = cz + tz * hw * side;
        nor[v * 3] = s0.ox;
        nor[v * 3 + 1] = 0.15;
        nor[v * 3 + 2] = s0.oz;
        uv[v * 2] = side < 0 ? 0 : 1;
        uv[v * 2 + 1] = 1 - s;
        W[v] = s;
        SD[v] = s0.seed;
        v++;
      }
    }
    for (let j = 0; j < segs; j++) {
      const a = first + j * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const base = Float32Array.from(pos);
  const geometry = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3);
  geometry.setAttribute('position', attr);
  geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(idx);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 4);
  const count = v;
  function update(t, amp, freq, stream, vib, side) {
    for (let k = 0; k < count; k++) {
      const i = k * 3;
      const w = W[k];
      const ph = t * freq + SD[k];
      const by = base[i + 1];
      const ww = w * w;
      pos[i] = base[i] + Math.sin(ph + by * 3.1) * amp * w + side * ww + (vib ? Math.sin(t * 63 + k * 1.7) * vib * ww * 0.04 : 0);
      pos[i + 1] = base[i + 1] - stream * 0.2 * ww;
      pos[i + 2] = base[i + 2] + Math.cos(ph * 0.83 + by * 2.3 + 1.3) * amp * 0.8 * w - stream * ww;
    }
    attr.needsUpdate = true;
  }
  return { geometry, update };
}
