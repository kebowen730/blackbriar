// Pure-math terrain description (no THREE): hills, creek, pond, sites, trails.
import { fbm2, mulberry32 } from '../core/rng.js';

export const HALF = 180;
export const EXT = 262; // terrain mesh half size (playable + dense forest skirt)

export const LAYOUT = {
  camp: { name: 'Campsite', x: 30, z: 130, pad: 8, clear: 15 },
  cabin: { name: 'Abandoned Cabin', x: -110, z: -20, pad: 7, clear: 15 },
  tower: { name: 'Ranger Tower', x: 110, z: -60, pad: 5, clear: 11 },
  car: { name: 'Wrecked Car', x: -60, z: -130, pad: 4, clear: 9 },
  grave: { name: 'Graveyard', x: -130, z: 110, pad: 11, clear: 19 },
  well: { name: 'Old Well', x: 90, z: 40, pad: 4, clear: 9 },
  wards: [
    { x: -140, z: -120, pad: 5, clear: 9 },
    { x: 140, z: -130, pad: 5, clear: 9 },
    { x: 150, z: 30, pad: 5, clear: 9 },
    { x: -150, z: 40, pad: 5, clear: 9 },
    { x: 45, z: 0, pad: 5, clear: 9 },
  ],
  pond: { name: 'Pond', x: -60, z: 70, rx: 16, rz: 12 },
};

const TRAIL_PAIRS = [
  ['camp', 'well'],
  ['well', 'tower'],
  ['camp', 'grave'],
  ['grave', 'cabin'],
  ['cabin', 'car'],
  ['cabin', 'w4'],
  ['w4', 'well'],
  ['w4', 'tower'],
  ['tower', 'w1'],
  ['well', 'w2'],
  ['grave', 'w3'],
  ['car', 'w0'],
];

const sm = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createTerrain(seed = 1) {
  const L = LAYOUT;
  const ox = seed * 13.7 + 100;
  const oz = seed * 7.3 - 40;

  const hills = (x, z) =>
    (fbm2(x * 0.0105 + ox, z * 0.0105 + oz, seed, 4) - 0.5) * 26 + (fbm2(x * 0.045 + oz, z * 0.045 + ox, seed + 9, 2) - 0.5) * 1.6;

  // flatten sites
  const sites = [];
  const addSite = (key, s) => {
    const site = { key, name: s.name, x: s.x, z: s.z, pad: s.pad, clear: s.clear, h: hills(s.x, s.z) };
    sites.push(site);
    return site;
  };
  for (const k of ['camp', 'cabin', 'tower', 'car', 'grave', 'well']) addSite(k, L[k]);
  L.wards.forEach((w, i) => addSite('w' + i, w));
  const siteByKey = {};
  for (const s of sites) siteByKey[s.key] = s;

  const flatH = (x, z) => {
    let h = hills(x, z);
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i];
      const dx = x - s.x;
      const dz = z - s.z;
      const R = s.pad * 1.9;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R) {
        const w = 1 - sm(s.pad, R, Math.sqrt(d2));
        h += (s.h - h) * w;
      }
    }
    return h;
  };

  // ---- pond + creek
  const P = L.pond;
  const pondW = flatH(P.x, P.z) - 0.55; // pond water surface
  const W = 2.6; // creek half width

  function cx(z) {
    const t = (z + 180) / (P.z + 180);
    const tc = Math.max(0, t);
    const f = Math.min(1, Math.max(0, 1 - t));
    return 75 + (P.x - 75) * tc + 30 * f * Math.sin(0.035 * z + 0.8) + 6 * f * Math.sin(0.11 * z + 2);
  }
  function creekK(z) {
    const s = (cx(z + 1) - cx(z - 1)) * 0.5;
    return Math.sqrt(1 + s * s);
  }
  function creekL(z) {
    const base = flatH(cx(z), z) - 0.35;
    const e = sm(P.z - 50, P.z, z);
    return base + (pondW + 0.2 - base) * e;
  }

  function heightAt(x, z) {
    let h = flatH(x, z);
    const dx = (x - P.x) / P.rx;
    const dz = (z - P.z) / P.rz;
    const q = dx * dx + dz * dz;
    if (q < 2.4) {
      const edge = pondW + 0.35;
      if (q < 1) h = edge - 1.3 * (1 - q);
      else h = edge + (h - edge) * sm(1, 2.4, q);
    }
    if (z < P.z) {
      const ad = Math.abs(x - cx(z));
      if (ad < 24) {
        const d = ad / creekK(z);
        if (d < W + 8) {
          const Lv = creekL(z);
          if (d <= W) {
            const u = d / W;
            h = Lv - 0.55 * (1 - u * u);
          } else h = Lv + (h - Lv) * sm(W, W + 8, d);
        }
      }
    }
    return h;
  }

  function isWater(x, z) {
    if (z < P.z) {
      const ad = Math.abs(x - cx(z));
      if (ad < 14 && ad / creekK(z) < W * 0.78) return true;
    }
    const dx = (x - P.x) / P.rx;
    const dz = (z - P.z) / P.rz;
    return dx * dx + dz * dz < 0.7;
  }

  // approx distance (m) from the water edge; negative inside
  function wetness(x, z) {
    let best = 1e9;
    if (z < P.z) {
      const ad = Math.abs(x - cx(z));
      if (ad < 40) best = ad / creekK(z) - W * 0.78;
    }
    const dx = (x - P.x) / P.rx;
    const dz = (z - P.z) / P.rz;
    const q = Math.sqrt(dx * dx + dz * dz);
    const pd = (q - 0.84) * 13;
    return Math.min(best, pd);
  }

  function creekRow(z) {
    return { x: cx(z), half: W * creekK(z) * 0.98, y: creekL(z) - 0.2 };
  }

  // ---- trails
  const trng = mulberry32(seed * 31 + 7);
  const segs = [];
  const trailLines = [];
  for (const [ka, kb] of TRAIL_PAIRS) {
    const a = siteByKey[ka];
    const b = siteByKey[kb];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(3, Math.ceil(len / 16));
    const nx = -(b.z - a.z) / len;
    const nz = (b.x - a.x) / len;
    const ph = trng() * 6;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const edge = Math.sin(t * Math.PI);
      const off = (Math.sin(t * 9 + ph) * 5 + (trng() - 0.5) * 3.5) * edge;
      pts.push([a.x + (b.x - a.x) * t + nx * off, a.z + (b.z - a.z) * t + nz * off]);
    }
    trailLines.push(pts);
    for (let i = 0; i < n; i++) segs.push(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }
  const trailSegs = new Float32Array(segs);

  function trailDist(x, z) {
    let best = 1e9;
    for (let i = 0; i < trailSegs.length; i += 4) {
      const ax = trailSegs[i];
      const az = trailSegs[i + 1];
      const dx = trailSegs[i + 2] - ax;
      const dz = trailSegs[i + 3] - az;
      const l2 = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + dx * t - x;
      const ez = az + dz * t - z;
      const d = ex * ex + ez * ez;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  // distance beyond the flat pad of the closest site (negative inside a pad)
  function padDist(x, z) {
    let best = 1e9;
    for (const s of sites) {
      const d = Math.hypot(x - s.x, z - s.z) - s.pad;
      if (d < best) best = d;
    }
    return best;
  }

  // true when no tree should grow here
  function clearAt(x, z, extra = 0) {
    for (const s of sites) {
      const r = s.clear + extra;
      const dx = x - s.x;
      const dz = z - s.z;
      if (dx * dx + dz * dz < r * r) return true;
    }
    if (wetness(x, z) < 2.2 + extra * 0.3) return true;
    if (trailDist(x, z) < 2.6 + extra * 0.3) return true;
    return false;
  }

  return {
    layout: L,
    sites,
    siteByKey,
    heightAt,
    isWater,
    wetness,
    creekRow,
    pond: { x: P.x, z: P.z, rx: P.rx, rz: P.rz, y: pondW },
    trailDist,
    trailLines,
    padDist,
    clearAt,
    creekHalfW: W,
  };
}
