// Procedural canvas textures for the world. Browser only (uses document.createElement('canvas')).
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

const TAU = Math.PI * 2;

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, { repeat = true, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
}

// draw fn at (x,y) and at wrapped copies so the texture tiles seamlessly
function wrapped(w, h, x, y, m, fn) {
  fn(x, y);
  const ox = x < m ? w : x > w - m ? -w : 0;
  const oy = y < m ? h : y > h - m ? -h : 0;
  if (ox) fn(x + ox, y);
  if (oy) fn(x, y + oy);
  if (ox && oy) fn(x + ox, y + oy);
}

const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

function blotches(g, w, h, r, n, minR, maxR, colFn) {
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = minR + r() * (maxR - minR);
    const col = colFn(r);
    wrapped(w, h, x, y, rad, (px, py) => {
      const gr = g.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, col[0]);
      gr.addColorStop(1, col[1]);
      g.fillStyle = gr;
      g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
}

export function groundTexture(aniso) {
  const [c, g] = mk(512, 512);
  const r = mulberry32(11);
  g.fillStyle = '#a89e8e';
  g.fillRect(0, 0, 512, 512);
  blotches(g, 512, 512, r, 420, 12, 46, (rr) => {
    const d = rr() < 0.5;
    return d ? [rgba(40, 32, 24, 0.28), rgba(40, 32, 24, 0)] : [rgba(230, 220, 190, 0.2), rgba(230, 220, 190, 0)];
  });
  // pine needles
  g.lineWidth = 1;
  for (let i = 0; i < 6000; i++) {
    const x = r() * 512;
    const y = r() * 512;
    const a = r() * TAU;
    const l = 5 + r() * 10;
    g.strokeStyle = r() < 0.55 ? rgba(30, 22, 12, 0.4) : rgba(200, 170, 120, 0.22);
    wrapped(512, 512, x, y, 16, (px, py) => {
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      g.stroke();
    });
  }
  // pebbles
  for (let i = 0; i < 380; i++) {
    const x = r() * 512;
    const y = r() * 512;
    const rad = 1 + r() * 3.2;
    const v = 120 + r() * 100;
    g.fillStyle = rgba(v, v * 0.97, v * 0.92, 0.55);
    wrapped(512, 512, x, y, 6, (px, py) => {
      g.beginPath();
      g.ellipse(px, py, rad, rad * 0.7, r() * 3, 0, TAU);
      g.fill();
    });
  }
  return toTex(c, { aniso });
}

export function barkTexture(aniso) {
  const [c, g] = mk(128, 256);
  const r = mulberry32(21);
  g.fillStyle = '#5a4a3c';
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 170; i++) {
    const x = r() * 128;
    const w = 1 + r() * 3.5;
    const dark = r() < 0.6;
    g.strokeStyle = dark ? rgba(18, 12, 8, 0.45 + r() * 0.3) : rgba(150, 128, 104, 0.25 + r() * 0.2);
    g.lineWidth = w;
    const ph = r() * 6;
    const amp = 0.6 + r() * 2;
    wrapped(128, 256, x, 0, w + amp + 2, (px) => {
      g.beginPath();
      for (let y = 0; y <= 256; y += 16) {
        const xx = px + Math.sin(y * 0.05 + ph) * amp;
        if (y === 0) g.moveTo(xx, y);
        else g.lineTo(xx, y);
      }
      g.stroke();
    });
  }
  // horizontal cracks
  for (let i = 0; i < 40; i++) {
    const x = r() * 128;
    const y = r() * 256;
    g.fillStyle = rgba(10, 6, 4, 0.4);
    wrapped(128, 256, x, y, 12, (px, py) => g.fillRect(px, py, 4 + r() * 8, 1 + r() * 1.5));
  }
  return toTex(c, { aniso });
}

export function needleTexture(aniso) {
  const [c, g] = mk(256, 256);
  const r = mulberry32(31);
  g.fillStyle = '#34503a';
  g.fillRect(0, 0, 256, 256);
  const pal = ['#16261a', '#24402a', '#3c6038', '#4f7446', '#1d3322'];
  g.lineWidth = 1.4;
  for (let i = 0; i < 3200; i++) {
    const x = r() * 256;
    const y = r() * 256;
    const a = Math.PI / 2 + (r() - 0.5) * 2.2;
    const l = 7 + r() * 12;
    g.strokeStyle = pal[(r() * pal.length) | 0];
    g.globalAlpha = 0.75;
    wrapped(256, 256, x, y, 20, (px, py) => {
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      g.stroke();
    });
  }
  g.globalAlpha = 1;
  return toTex(c, { aniso });
}

export function rockTexture(aniso) {
  const [c, g] = mk(256, 256);
  const r = mulberry32(41);
  g.fillStyle = '#8c8e8c';
  g.fillRect(0, 0, 256, 256);
  blotches(g, 256, 256, r, 160, 8, 36, (rr) => {
    const d = rr() < 0.5;
    return d ? [rgba(30, 32, 34, 0.35), rgba(30, 32, 34, 0)] : [rgba(210, 215, 205, 0.25), rgba(210, 215, 205, 0)];
  });
  // moss patches
  blotches(g, 256, 256, r, 26, 8, 26, () => [rgba(60, 90, 50, 0.3), rgba(60, 90, 50, 0)]);
  g.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    let x = r() * 256;
    let y = r() * 256;
    g.strokeStyle = rgba(15, 16, 18, 0.55);
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (r() - 0.5) * 22;
      y += (r() - 0.3) * 18;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 1800; i++) {
    const v = 90 + r() * 120;
    g.fillStyle = rgba(v, v, v, 0.4);
    g.fillRect(r() * 256, r() * 256, 1.2, 1.2);
  }
  return toTex(c, { aniso });
}

export function leafTexture(aniso) {
  const [c, g] = mk(256, 256);
  const r = mulberry32(51);
  g.fillStyle = '#243622';
  g.fillRect(0, 0, 256, 256);
  const pal = ['#1a2a1a', '#2f4a2a', '#43602f', '#3a2a32', '#52402e', '#27402a'];
  for (let i = 0; i < 2200; i++) {
    const x = r() * 256;
    const y = r() * 256;
    g.fillStyle = pal[(r() * pal.length) | 0];
    g.globalAlpha = 0.8;
    const a = r() * TAU;
    wrapped(256, 256, x, y, 10, (px, py) => {
      g.beginPath();
      g.ellipse(px, py, 3 + r() * 4, 1.5 + r() * 2, a, 0, TAU);
      g.fill();
    });
  }
  g.globalAlpha = 1;
  return toTex(c, { aniso });
}

export function grassCardTexture(aniso) {
  const [c, g] = mk(128, 256);
  const r = mulberry32(61);
  for (let i = 0; i < 18; i++) {
    const bx = 6 + r() * 116;
    const ty = 10 + r() * 120;
    const lean = (r() - 0.5) * 56;
    const w = 2.5 + r() * 3.5;
    const gr = g.createLinearGradient(0, 256, 0, ty);
    gr.addColorStop(0, '#1d3019');
    gr.addColorStop(0.6, '#3d5a2c');
    gr.addColorStop(1, '#7d9a58');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(bx - w, 256);
    g.quadraticCurveTo(bx + lean * 0.1 - w * 0.6, 256 - (256 - ty) * 0.55, bx + lean, ty);
    g.quadraticCurveTo(bx + lean * 0.1 + w * 0.6, 256 - (256 - ty) * 0.5, bx + w, 256);
    g.closePath();
    g.fill();
  }
  return toTex(c, { repeat: false, aniso });
}

export function fernCardTexture(aniso) {
  const [c, g] = mk(256, 256);
  const r = mulberry32(71);
  const fronds = [
    [128, 250, 40, 40],
    [128, 250, 205, 70],
    [128, 250, 128, 12],
    [128, 250, 75, 120],
    [128, 250, 180, 125],
  ];
  for (const [bx, by, tx, ty] of fronds) {
    const cx = (bx + tx) / 2 + (tx - bx) * 0.1;
    const cy = (by + ty) / 2 - 20;
    const N = 22;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const px = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * tx;
      const py = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy + t * t * ty;
      const dx = 2 * (1 - t) * (cx - bx) + 2 * t * (tx - cx);
      const dy = 2 * (1 - t) * (cy - by) + 2 * t * (ty - cy);
      const ang = Math.atan2(dy, dx);
      const len = 30 * Math.sin(Math.PI * (0.12 + 0.88 * (1 - t) * 0.9 + 0.05)) + 4;
      for (const s of [-1, 1]) {
        const a2 = ang + s * (0.9 - t * 0.35);
        g.strokeStyle = r() < 0.5 ? '#35602f' : '#427038';
        g.lineWidth = 3.2 * (1 - t * 0.6);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(a2) * len, py + Math.sin(a2) * len);
        g.stroke();
      }
    }
    g.strokeStyle = '#2b4a26';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(bx, by);
    g.quadraticCurveTo(cx, cy, tx, ty);
    g.stroke();
  }
  return toTex(c, { repeat: false, aniso });
}

export function grainTexture(aniso) {
  const [c, g] = mk(256, 256);
  const r = mulberry32(81);
  g.fillStyle = '#c9c4bc';
  g.fillRect(0, 0, 256, 256);
  blotches(g, 256, 256, r, 120, 10, 40, (rr) =>
    rr() < 0.5 ? [rgba(60, 55, 50, 0.22), rgba(60, 55, 50, 0)] : [rgba(255, 250, 240, 0.18), rgba(255, 250, 240, 0)]
  );
  for (let i = 0; i < 160; i++) {
    const x = r() * 256;
    const w = 0.8 + r() * 2;
    g.strokeStyle = r() < 0.6 ? rgba(30, 25, 20, 0.28) : rgba(240, 235, 225, 0.16);
    g.lineWidth = w;
    wrapped(256, 256, x, 0, 6, (px) => {
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px + (r() - 0.5) * 3, 256);
      g.stroke();
    });
  }
  for (let i = 0; i < 1400; i++) {
    const v = 100 + r() * 130;
    g.fillStyle = rgba(v, v, v, 0.3);
    g.fillRect(r() * 256, r() * 256, 1.3, 1.3);
  }
  return toTex(c, { aniso });
}

// emissive rune map: black with luminous carved glyphs and groove lines
export function runeTexture(seed, aniso) {
  const [c, g] = mk(256, 512);
  const r = mulberry32(seed * 977 + 5);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 512);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = '#7fe8ff';
  g.shadowBlur = 10;
  g.strokeStyle = '#e8ffff';
  // side grooves
  g.lineWidth = 3;
  for (const x of [26, 230]) {
    g.beginPath();
    g.moveTo(x, 20);
    g.lineTo(x, 492);
    g.stroke();
  }
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    const cy = 50 + i * 50;
    const cx = 128;
    // 3x4 lattice
    const pts = [];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) pts.push([cx - 34 + a * 34, cy - 21 + b * 14]);
    g.lineWidth = 4.2;
    const strokes = 3 + ((r() * 3) | 0);
    for (let s = 0; s < strokes; s++) {
      const p0 = pts[(r() * pts.length) | 0];
      const p1 = pts[(r() * pts.length) | 0];
      const p2 = r() < 0.5 ? pts[(r() * pts.length) | 0] : null;
      g.beginPath();
      g.moveTo(p0[0], p0[1]);
      g.lineTo(p1[0], p1[1]);
      if (p2) g.lineTo(p2[0], p2[1]);
      g.stroke();
    }
    if (r() < 0.4) {
      g.beginPath();
      g.arc(cx + (r() - 0.5) * 30, cy, 9 + r() * 6, 0, TAU);
      g.stroke();
    }
  }
  g.shadowBlur = 0;
  return toTex(c, { repeat: false, aniso });
}

export function glowTexture() {
  const [c, g] = mk(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(190,240,255,0.9)');
  gr.addColorStop(0.35, 'rgba(120,200,255,0.35)');
  gr.addColorStop(1, 'rgba(60,140,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return toTex(c, { repeat: false });
}

// seamless tiling water normal map from summed sines
export function waterNormalTexture(aniso) {
  const S = 256;
  const [c, g] = mk(S, S);
  const img = g.createImageData(S, S);
  const waves = [
    [1, 2, 0.4, 1.0],
    [3, 1, 1.7, 0.7],
    [2, 5, 2.9, 0.5],
    [6, 3, 0.9, 0.35],
    [7, 9, 4.1, 0.22],
    [11, 4, 5.3, 0.16],
  ];
  const k = TAU / S;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let dx = 0;
      let dy = 0;
      for (const [kx, ky, ph, A] of waves) {
        const cs = Math.cos((kx * x + ky * y) * k + ph) * A * k;
        dx += kx * cs;
        dy += ky * cs;
      }
      const nx = -dx * 5;
      const ny = -dy * 5;
      const l = Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * S + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTex(c, { srgb: false, aniso });
}

export function makeTextures(aniso = 4) {
  return {
    ground: groundTexture(aniso),
    bark: barkTexture(aniso),
    needle: needleTexture(aniso),
    rock: rockTexture(aniso),
    leaf: leafTexture(aniso),
    grass: grassCardTexture(aniso),
    fern: fernCardTexture(aniso),
    grain: grainTexture(aniso),
    waterNormal: waterNormalTexture(aniso),
    glow: glowTexture(),
  };
}
