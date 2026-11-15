import * as THREE from 'three';
import {
  clamp, lerp, prng, canvasTex, stdMat, glowMat, warp, ellipsoid, limbGeo, stalkGeo,
  add, pivot, Rig, P,
} from './_helpersB.js';

function barkTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = prng(21);
    g.fillStyle = '#3a322b'; g.fillRect(0, 0, w, h);
    // scaly plates in vertical columns
    for (let c = 0; c < 22; c++) {
      let y = -r() * 40;
      const x = (c / 22) * w;
      while (y < h) {
        const ph = 18 + r() * 40, pw = w / 22 * (0.7 + r() * 0.5);
        const l = 38 + r() * 26;
        g.fillStyle = `rgb(${l + 6},${l},${l - 6})`;
        g.fillRect(x, y, pw, ph - 3);
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(x, y + ph - 3, pw, 3);
        y += ph;
      }
      g.fillStyle = 'rgba(8,6,5,0.75)';
      g.fillRect(x - 1, 0, 3, h);
    }
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '90,100,80' : '10,8,6'},${0.05 + r() * 0.1})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 10);
    }
  }, 2, 3);
}
function needleTex() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = prng(8);
    g.fillStyle = '#1c2a22'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const l = 28 + r() * 40;
      g.strokeStyle = `rgba(${l - 8},${l + 14},${l},${0.3 + r() * 0.4})`;
      g.lineWidth = 1;
      const x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 10, y + 5 + r() * 12); g.stroke();
    }
    for (let i = 0; i < 25; i++) {
      g.fillStyle = 'rgba(110,120,95,0.18)';
      g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 8, 2 + r() * 5, 0, 0, 6.3); g.fill();
    }
  }, 2, 2);
}

function droopCone(r, h, seed) {
  const g = new THREE.ConeGeometry(r, h, 9, 1, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < -h / 2 + 1e-4 && (x * x + z * z) > 1e-6) {
      const a = Math.atan2(z, x);
      const k = 0.5 + 0.5 * Math.sin(a * 5 + seed);
      p.setXYZ(i, x * (0.85 + 0.2 * k), y - 0.16 * k, z * (0.85 + 0.2 * k));
    }
  }
  g.computeVertexNormals();
  return g;
}

export function build() {
  const group = new THREE.Group();
  const rig = new Rig();
  const bark = stdMat(0x6d645a, 0.97, { map: barkTex() });
  const needles = stdMat(0x9aa595, 0.97, { map: needleTex() });
  const dark = stdMat(0x060403, 0.9);
  const eyeM = glowMat(0x9dffb4);
  const eyeBase = new THREE.Color(0x9dffb4);
  const J = { root: [], sh: [], el: [] };

  // trunk: lower + upper (bends/sways)
  const lower = pivot(group, 0, 0.0, 0);
  J.lower = rig.add(lower);
  add(lower, warp(new THREE.CylinderGeometry(0.42, 0.62, 1.8, 9, 3).translate(0, 0.9, 0), 0.05, 3, 1), bark);
  const upper = pivot(lower, 0, 1.8, 0);
  J.upper = rig.add(upper);
  add(upper, warp(new THREE.CylinderGeometry(0.26, 0.42, 2.0, 9, 3).translate(0, 1.0, 0), 0.04, 3.5, 2), bark);

  // dead lower branch stubs (tree disguise)
  const rr = prng(3);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.2 + 0.5;
    const s = add(upper, stalkGeo(0.05, 0.015, 0.6, 5), bark, Math.sin(a) * 0.34, 0.3 + i * 0.35, Math.cos(a) * 0.34);
    s.rotation.set(Math.cos(a) * 1.0, 0, -Math.sin(a) * 1.0);
  }

  // face hidden in the bark at ~3 m (upper local y 1.25)
  const fy = 1.25, fz = 0.3;
  for (const s of [-1, 1]) {
    const brow = add(upper, ellipsoid(0.1, 0.035, 0.07, 6, 4), bark, s * 0.09, fy + 0.07, fz - 0.02);
    brow.rotation.z = -s * 0.35;
    add(upper, ellipsoid(0.055, 0.04, 0.04, 6, 4), dark, s * 0.085, fy, fz - 0.015);
  }
  const eyes = [];
  for (const s of [-1, 1]) eyes.push(add(upper, new THREE.SphereGeometry(0.026, 8, 6), eyeM, s * 0.085, fy, fz + 0.005));
  const mouth = add(upper, ellipsoid(0.035, 0.24, 0.035, 6, 6), dark, 0, fy - 0.3, fz - 0.005);
  J.mouth = mouth;

  // crown: drooping conical foliage layers
  const crown = pivot(upper, 0, 0, 0); J.crown = rig.add(crown);
  const layers = [[1.5, 1.15, 0.65], [1.78, 0.9, 0.58], [2.03, 0.66, 0.5], [2.26, 0.42, 0.45]];
  layers.forEach((l, i) => {
    add(crown, droopCone(l[1], l[2], i * 1.7), needles, 0, l[0] + l[2] / 2, 0);
  });

  // root-like splayed feet
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const p = pivot(group, Math.sin(a) * 0.3, 0.42, Math.cos(a) * 0.3);
    p.rotation.y = a; p.rotation.x = -1.1;
    add(p, limbGeo(0.17, 0.09, 0.8, 5), bark);
    const p2 = pivot(p, 0, -0.8, 0); p2.rotation.x = 0.55;
    add(p2, limbGeo(0.09, 0.025, 0.75, 5), bark);
    J.root.push({ a, j: rig.add(p), j2: rig.add(p2) });
  }

  // long branch arms with twig fingers
  for (const s of [1, -1]) {
    const sh = pivot(upper, s * 0.3, 1.05, 0);
    add(sh, limbGeo(0.1, 0.065, 1.2, 6), bark);
    const el = pivot(sh, 0, -1.2, 0);
    add(el, limbGeo(0.065, 0.04, 1.15, 6), bark);
    const hand = pivot(el, 0, -1.15, 0);
    for (let f = 0; f < 3; f++) {
      const fg = add(hand, limbGeo(0.025, 0.005, 0.45 + f * 0.06, 4), bark);
      fg.rotation.z = (f - 1) * 0.4; fg.rotation.x = 0.15 * (f - 1);
    }
    J.sh.push({ s, j: rig.add(sh) }); J.el.push({ s, j: rig.add(el) });
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  let glow = 0, mouthW = 1;
  eyeM.color.setRGB(0, 0, 0);
  eyes.forEach((e) => { e.visible = false; });

  function arm(i, th, el, fwd, tr) {
    const s = J.sh[i].s;
    P(J.sh[i].j, -fwd, 0, s * (th + tr));
    P(J.el[i].j, 0, 0, s * el);
  }

  function animate(anim, t, dt, speed) {
    const sp = speed || 0;
    const L = anim === 'frozen' ? 0 : 1;
    let a = anim;
    if (!a || a === 'fly') a = 'idle';
    if (a === 'crawl') a = 'walk';
    rig.reset();
    let rate = 4;
    let eyeT = 1, mT = 1, scale = 1;

    const sway = Math.sin(t * 0.7) * L;
    let lx = 0, lz = 0, py = 0, px = 0, ry = 0;
    let th = 2.3, el = 1.5, fwd = 0, tr = 0;

    if (a === 'frozen' || anim === 'frozen') { eyeT = 0; }
    if (a === 'idle') {
      lz = 0.02 * sway; lx = 0.015 * Math.sin(t * 0.5) * L;
      th += 0.04 * Math.sin(t * 0.6) * L;
      eyeT = anim === 'frozen' ? 0 : 0.85 + 0.15 * Math.sin(t * 1.3);
    } else if (a === 'walk' || a === 'run') {
      rate = a === 'run' ? 7 : 4.5;
      const ph = t * (1.5 + sp * 0.55);
      lx = 0.1; lz = 0.05 * Math.sin(ph); py = 0.07 * Math.abs(Math.sin(ph)) ; ry = 0.06 * Math.sin(ph);
      th = 0.55 + 0.25 * Math.sin(ph * 0.5); el = 0.3 + 0.2 * Math.sin(ph + 1); fwd = 0.25; tr = 0;
      eyeT = 1;
    } else if (a === 'attack') {
      rate = 9;
      const s = 0.5 + 0.5 * Math.sin(t * 4);
      lx = 0.25 + 0.1 * s; th = lerp(2.0, 0.7, s); el = lerp(0.2, -1.0, s); fwd = 1.3 * s + 0.2; tr = 0;
      eyeT = 1.1; mT = 1.9;
      py = -0.06 * s;
    } else if (a === 'special') {
      rate = 10;
      const sh = Math.sin(t * 33), sh2 = Math.sin(t * 27 + 1);
      px = 0.03 * sh; lz = 0.04 * sh2; lx = 0.03 * sh;
      th = 1.7 + 0.08 * sh; el = 0.6; fwd = 0; eyeT = 1.6; mT = 1.5; scale = 1.5;
    }

    P(J.lower, lx * 0.5, ry * 0.5, lz * 0.5, px, py, 0);
    P(J.upper, lx, ry, lz, px * 0.5, 0, 0);
    P(J.crown, 0.03 * Math.sin(t * 1.1 + 1) * L + lx * 0.3, 0, 0.04 * Math.sin(t * 0.9) * L + (a === 'walk' || a === 'run' ? 0.08 * Math.sin(t * 2.4) : 0));
    for (let i = 0; i < 2; i++) arm(i, th, el, fwd, i ? 0.05 * Math.sin(t * 0.8) * L : 0.03 * Math.sin(t * 0.7 + 1) * L);

    // roots: splay at rest, drag/step when moving
    const mv = (a === 'walk' || a === 'run') ? 1 : 0;
    const ph = t * (1.5 + sp * 0.55);
    for (let i = 0; i < 6; i++) {
      const r = J.root[i];
      const wv = Math.sin(ph + r.a * 2.0) * mv;
      P(r.j, 0.35 * wv, 0, 0, 0, 0, 0);
      P(r.j2, -0.3 * wv, 0, 0);
    }

    // eyes (dark when frozen, glowing otherwise) + mouth
    const k = 1 - Math.exp(-dt * 6);
    glow += (eyeT - glow) * (anim === 'frozen' ? 1 : k);
    const g = clamp(glow, 0, 1);
    eyeM.color.copy(eyeBase).multiplyScalar(g);
    const vis = glow > 0.03;
    for (let i = 0; i < 2; i++) {
      eyes[i].visible = vis;
      eyes[i].scale.setScalar(lerp(eyes[i].scale.x, scale * (0.8 + 0.2 * g), k));
    }
    mouthW += (mT - mouthW) * k;
    mouth.scale.set(mouthW, 1, 1);
    rig.apply(dt, rate);
  }

  return { group, height: 4.5, eyeHeight: 3.05, eyes, eyeMaterial: eyeM, animate };
}
