import * as THREE from 'three';
import {
  clamp, lerp, prng, canvasTex, stdMat, glowMat, warp, ellipsoid, limbGeo, stalkGeo, xGeo,
  add, pivot, bone, Rig, P,
} from './_helpersB.js';

// wing outline per segment (x = span, z = chord; front edge f, back edge b)
const SEG = [
  { L: 0.75, f0: 0.15, b0: -1.0, f1: 0.1, b1: -1.35 },
  { L: 0.65, f0: 0.1, b0: -1.35, f1: 0.0, b1: -1.0 },
  { L: 0.55, f0: 0.0, b0: -1.0, f1: -0.15, b1: -0.3 },
];
const SPAN = 1.95;

function wingGeo(seg, u0, u1) {
  const nx = 4, nz = 4, pos = [], uv = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const u = i / nx, x = u * seg.L;
    const zf = lerp(seg.f0, seg.f1, u);
    const zb = lerp(seg.b0, seg.b1, u) * (1 + 0.07 * Math.sin(i * 5.3 + u0 * 9));
    for (let j = 0; j <= nz; j++) {
      const v = j / nz;
      pos.push(x, -0.05 * Math.sin(v * 3.14) + 0.018 * Math.sin(i * 2.1 + j * 1.7), lerp(zf, zb, v));
      uv.push(lerp(u0, u1, u), 1 - v);
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j, b = a + 1, c = a + nz + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function wingTexture() {
  return canvasTex(512, 256, (g, w, h) => {
    const r = prng(77);
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#2b2824'); grd.addColorStop(0.5, '#3a352f'); grd.addColorStop(1, '#232120');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // dusty scales
    for (let i = 0; i < 5000; i++) {
      const l = 30 + r() * 50;
      g.fillStyle = `rgba(${l + 14},${l + 8},${l},${0.05 + r() * 0.12})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 8, 1 + r() * 3);
    }
    // veins fanning from the root
    g.strokeStyle = 'rgba(12,10,9,0.55)';
    for (let i = 0; i < 16; i++) {
      g.lineWidth = 1 + r() * 1.6;
      g.beginPath(); g.moveTo(0, h * (0.1 + 0.2 * r()));
      g.bezierCurveTo(w * 0.3, h * r(), w * 0.65, h * r(), w, h * (i / 15));
      g.stroke();
    }
    // dull eyespots
    for (const [cx, cy, rr] of [[w * 0.38, h * 0.62, 34], [w * 0.7, h * 0.5, 26], [w * 0.2, h * 0.7, 22]]) {
      for (let k = 4; k > 0; k--) {
        g.fillStyle = ['#0b0a09', '#4b3a2c', '#14100d', '#5a4838'][k - 1];
        g.beginPath(); g.ellipse(cx, cy, rr * k / 4 * 1.2, rr * k / 4, 0.3, 0, 6.3); g.fill();
      }
    }
    // dark trailing edge
    const e = g.createLinearGradient(0, h * 0.7, 0, h);
    e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = e; g.fillRect(0, h * 0.7, w, h * 0.3);
  });
}

function furTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = prng(5);
    g.fillStyle = '#26241f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const l = 20 + r() * 45;
      g.strokeStyle = `rgba(${l + 10},${l + 8},${l + 4},${0.25 + r() * 0.4})`;
      g.lineWidth = 1;
      const x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + 3 + r() * 7); g.stroke();
    }
  }, 2, 2);
}

export function build() {
  const group = new THREE.Group();
  const rig = new Rig();
  const fur = stdMat(0x4a4640, 0.97, { map: furTexture() });
  const wingM = stdMat(0xffffff, 0.95, { map: wingTexture(), side: THREE.DoubleSide, flatShading: false });
  const eyeM = glowMat(0xff0808);
  const J = {};

  const body = pivot(group, 0, 1.2, 0);
  J.body = rig.add(body);
  // torso + shoulder mound (no head)
  add(body, warp(ellipsoid(0.45, 0.65, 0.36, 14, 10), 0.05, 4, 1), fur, 0, 0.45, 0);
  add(body, warp(ellipsoid(0.27, 0.27, 0.27, 10, 8), 0.04, 5, 2), fur, 0, 0.85, -0.02);
  add(body, warp(ellipsoid(0.2, 0.2, 0.22, 8, 6), 0.03, 5, 3), fur, 0, -0.05, 0);
  // ruff of fuzz around the shoulders
  const rr = prng(11);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const m = add(body, stalkGeo(0.1, 0.0, 0.3, 5), fur, Math.sin(a) * 0.3, 0.74, Math.cos(a) * 0.24 - 0.02);
    m.rotation.set(Math.cos(a) * 0.9 + (rr() - 0.5) * 0.3, 0, -Math.sin(a) * 0.9);
  }
  // eyes (big, round, deep red)
  for (const s of [-1, 1]) add(body, new THREE.SphereGeometry(0.115, 14, 10), eyeM, s * 0.19, 0.72, 0.265);

  // legs (thin, dangling)
  J.hip = []; J.knee = []; J.foot = []; J.sh = []; J.e1 = []; J.e2 = []; J.ash = []; J.aelb = [];
  for (const s of [1, -1]) {
    const hip = pivot(body, s * 0.13, 0, 0);
    add(hip, limbGeo(0.055, 0.038, 0.58), fur);
    const knee = pivot(hip, 0, -0.58, 0);
    add(knee, limbGeo(0.038, 0.024, 0.58), fur);
    const foot = pivot(knee, 0, -0.58, 0);
    foot.rotation.x = -0.8;
    add(foot, limbGeo(0.026, 0.008, 0.2), fur);
    J.hip.push(rig.add(hip)); J.knee.push(rig.add(knee)); J.foot.push(rig.add(foot));
    // thin dangling arms
    const ash = pivot(body, s * 0.4, 0.72, 0.04);
    add(ash, limbGeo(0.04, 0.03, 0.42), fur);
    const ael = pivot(ash, 0, -0.42, 0);
    add(ael, limbGeo(0.03, 0.01, 0.44), fur);
    J.ash.push(rig.add(ash)); J.aelb.push(rig.add(ael));
  }

  // wings: right is built normally, left mirrored via scale.x = -1
  for (const side of [1, -1]) {
    const mount = pivot(body, side * 0.3, 0.82, -0.12);
    mount.scale.x = side;
    const sh = pivot(mount);
    add(sh, wingGeo(SEG[0], 0, SEG[0].L / SPAN), wingM);
    add(sh, xGeo(0.034, 0.024, SEG[0].L), fur, 0, 0, 0.14);
    const e1 = pivot(sh, SEG[0].L, 0, 0);
    const u1 = SEG[0].L / SPAN, u2 = (SEG[0].L + SEG[1].L) / SPAN;
    add(e1, wingGeo(SEG[1], u1, u2), wingM);
    add(e1, xGeo(0.024, 0.018, SEG[1].L), fur, 0, 0, 0.09);
    const e2 = pivot(e1, SEG[1].L, 0, 0);
    add(e2, wingGeo(SEG[2], u2, 1), wingM);
    add(e2, xGeo(0.018, 0.008, SEG[2].L), fur, 0, 0, 0.0);
    J.sh.push(rig.add(sh)); J.e1.push(rig.add(e1)); J.e2.push(rig.add(e2));
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  function wings(sz, sy, sx, ez, ey, fz, fy, tr, t) {
    for (let i = 0; i < 2; i++) {
      const ph = i * 0.9;
      P(J.sh[i], sx, sy, sz);
      P(J.e1[i], 0, ey, ez);
      P(J.e2[i], tr * 0.8 * Math.sin(t * 21 + ph), fy, fz + tr * Math.sin(t * 17 + ph * 2));
    }
  }

  function animate(anim, t, dt, speed) {
    const sp = speed || 0;
    const L = anim === 'frozen' ? 0 : 1;
    let a = anim;
    if (a === 'frozen' || !a) a = 'idle';
    rig.reset();
    let rate = 7;
    const w = t * 5.4, fl = Math.sin(w);

    if (a === 'fly') {
      rate = 9;
      const tilt = clamp(sp * 0.045, 0, 0.65);
      P(J.body, 0.15 + tilt, 0, 0.04 * Math.sin(w * 0.5), 0, 0.12 * fl, 0);
      for (let i = 0; i < 2; i++) {
        P(J.sh[i], 0, 0.1 - 0.25 * fl, 0.12 + 0.78 * fl);
        P(J.e1[i], 0, 0.05, -0.1 + 0.5 * Math.sin(w - 0.95));
        P(J.e2[i], 0, 0.05, 0.6 * Math.sin(w - 1.9));
        P(J.hip[i], 0.3 + 0.1 * Math.sin(w - 0.6 + i), 0, 0);
        P(J.knee[i], 0.35 + 0.12 * Math.sin(w - 1.2 + i), 0, 0);
        P(J.foot[i], 0.2, 0, 0);
        P(J.ash[i], 0.5, 0, 0.1);
        P(J.aelb[i], 0.3, 0, 0);
      }
    } else if (a === 'attack') {
      rate = 10;
      P(J.body, 1.1, 0, 0.03 * Math.sin(t * 9), 0, 0, 0);
      for (let i = 0; i < 2; i++) {
        P(J.sh[i], 0.1, 1.15, 0.3 + 0.14 * Math.sin(t * 9));
        P(J.e1[i], 0, 0.35, 0.05);
        P(J.e2[i], 0, 0.5, 0.0);
        P(J.hip[i], 0.35, 0, 0);
        P(J.knee[i], 0.5, 0, 0);
        P(J.foot[i], 0.2, 0, 0);
        P(J.ash[i], 0.9, 0, 0.1);
        P(J.aelb[i], 0.2, 0, 0);
      }
    } else if (a === 'special') {
      rate = 9;
      const q = Math.sin(t * 31);
      P(J.body, -0.2, 0, 0.02 * q, 0.015 * q, 0, 0);
      wings(0.5 + 0.06 * q, 0.1, 0, 0.1, 0.05, 0.1, 0.05, 0.1, t);
      for (let i = 0; i < 2; i++) {
        P(J.ash[i], 0, 0, 0.5);
        P(J.hip[i], -0.1, 0, 0.1 * (i ? -1 : 1));
      }
    } else if (a === 'walk' || a === 'run' || a === 'crawl') {
      const run = a === 'run';
      const ph = t * (3 + sp * 1.0);
      const amp = clamp(sp / 2.5, 0.35, 1.2);
      P(J.body, 0.1 + (run ? 0.2 : 0), 0, 0.05 * Math.sin(ph), 0, 0.04 * Math.abs(Math.sin(ph)), 0);
      for (let i = 0; i < 2; i++) {
        const s = Math.sin(ph + i * Math.PI);
        P(J.hip[i], 0.5 * amp * s, 0, 0);
        P(J.knee[i], 0.2 + 0.5 * amp * Math.max(0, -s), 0, 0);
        P(J.foot[i], 0.1, 0, 0);
        P(J.ash[i], -0.3 * s, 0, 0.1);
        P(J.aelb[i], 0.2, 0, 0);
        P(J.sh[i], 0, 0.55 + (run ? 0.4 : 0), -1.0 + 0.04 * Math.sin(t * 19 + i));
        P(J.e1[i], 0, 0.1, -0.25);
        P(J.e2[i], 0, 0, -0.3);
      }
    } else {
      // idle / unknown: standing, wings folded like a cloak, edges trembling
      const br = Math.sin(t * 1.7) * L;
      P(J.body, 0.03 + 0.02 * br, 0.04 * Math.sin(t * 0.5) * L, 0.02 * Math.sin(t * 0.8) * L, 0, 0.012 * br, 0);
      for (let i = 0; i < 2; i++) {
        P(J.sh[i], 0.05, 0.35, -1.42 + 0.02 * br);
        P(J.e1[i], 0, 0.1, -0.12);
        P(J.e2[i], 0.05 * L * Math.sin(t * 23 + i * 2), 0.1, -0.22 + 0.05 * L * Math.sin(t * 17 + i));
        P(J.hip[i], 0.04 * L * Math.sin(t * 0.9 + i * 2), 0, 0);
        P(J.knee[i], 0.05, 0, 0);
        P(J.foot[i], 0, 0, 0);
        P(J.ash[i], 0.06 * L * Math.sin(t * 1.1 + i), 0, 0.12);
        P(J.aelb[i], 0.15, 0, 0);
      }
    }
    rig.apply(dt, a === 'idle' && L === 0 ? 7 : rate);
  }

  return { group, height: 2.3, eyeHeight: 1.92, animate };
}
