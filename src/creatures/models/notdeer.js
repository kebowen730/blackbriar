import * as THREE from 'three';
import {
  prng, hash1, canvasTex, stdMat, glowMat, warp, ellipsoid, limbGeo, stalkGeo, zGeo,
  add, pivot, bone, Rig, P,
} from './_helpersB.js';

function furTex() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = prng(4);
    g.fillStyle = '#5b4a3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const l = 60 + r() * 60;
      g.strokeStyle = `rgba(${l + 20},${l + 8},${l - 10},${0.2 + r() * 0.35})`;
      g.lineWidth = 1;
      const x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + 3 + r() * 6); g.stroke();
    }
    for (let i = 0; i < 12; i++) { // faint wrong pale patches
      g.fillStyle = 'rgba(190,175,150,0.07)';
      g.beginPath(); g.ellipse(r() * w, r() * h, 8 + r() * 14, 5 + r() * 8, r() * 3, 0, 6.3); g.fill();
    }
  }, 2, 2);
}

// leg segment lengths: [upper, lower, extra(!), cannon]
const HIND = [0.3, 0.27, 0.2, 0.27];
const FORE = [0.24, 0.24, 0.2, 0.24];
const HB = [-0.55, 0.95, -0.7, 0.45];
const FB = [0.35, -0.4, 0.3, -0.2];
const VAR = [0.93, 1.07, 0.97, 1.09]; // each leg slightly different length
const FR = [9.0, 11.3, 8.4, 10.2];

export function build() {
  const group = new THREE.Group();
  const rig = new Rig();
  const fur = stdMat(0x6a5646, 0.95, { map: furTex() });
  const antl = stdMat(0xb9ae94, 0.8);
  const dark = stdMat(0x120e0b, 0.8);
  const eyeM = glowMat(0xfff0b8);
  const J = { leg: [] };

  const body = pivot(group, 0, 0.98, -0.55);
  J.body = rig.add(body);
  add(body, warp(ellipsoid(0.24, 0.27, 0.3, 10, 8), 0.02, 4, 1), fur, 0, 0, 0.05);
  add(body, warp(ellipsoid(0.2, 0.25, 0.6, 10, 8), 0.02, 3, 2), fur, 0, 0.02, 0.6);

  function leg(x, y, z, lens, base, scale) {
    const js = [];
    let parent = body;
    let py = 0;
    for (let k = 0; k < 4; k++) {
      const p = pivot(parent, k === 0 ? x : 0, k === 0 ? y : py, k === 0 ? z : 0);
      const len = lens[k] * scale;
      const r0 = [0.06, 0.045, 0.035, 0.03][k], r1 = [0.045, 0.035, 0.03, 0.01][k];
      add(p, limbGeo(r0, r1, len, 6), k === 3 ? dark : fur);
      p.rotation.x = base[k];
      js.push(rig.add(p));
      parent = p; py = -len;
    }
    return js;
  }
  J.leg.push(leg(-0.12, -0.05, 0.0, HIND, HB, VAR[0]));
  J.leg.push(leg(0.12, -0.05, 0.0, HIND, HB, VAR[1]));
  J.leg.push(leg(-0.11, -0.1, 1.05, FORE, FB, VAR[2]));
  J.leg.push(leg(0.11, -0.1, 1.05, FORE, FB, VAR[3]));

  // too-long neck, too-narrow head
  const n1 = pivot(body, 0, 0.16, 1.12); J.n1 = rig.add(n1);
  add(n1, stalkGeo(0.1, 0.07, 0.55, 6), fur);
  const n2 = pivot(n1, 0, 0.55, 0); J.n2 = rig.add(n2);
  add(n2, stalkGeo(0.07, 0.055, 0.5, 6), fur);
  const head = pivot(n2, 0, 0.5, 0); J.head = rig.add(head);
  add(head, zGeo(0.078, 0.038, 0.38, 7), fur, 0, 0, -0.08);
  const jaw = pivot(head, 0, -0.045, 0.0); J.jaw = rig.add(jaw);
  add(jaw, zGeo(0.034, 0.02, 0.3, 6), dark, 0, 0, 0);
  // eyes: forward-facing, too close together
  for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(0.021, 8, 6), eyeM, s * 0.033, 0.03, 0.15);
  J.ear = [];
  for (const s of [-1, 1]) {
    const e = pivot(head, s * 0.06, 0.05, -0.05);
    const m = add(e, stalkGeo(0.045, 0.008, 0.22, 5), fur);
    m.scale.z = 0.4;
    e.rotation.z = -s * 1.1; e.rotation.x = -0.3;
    J.ear.push(rig.add(e));
  }

  // asymmetrical antlers: right = normal-ish, left = one palm of finger-like tines
  bone(head, [0.045, 0.06, -0.02], [0.12, 0.28, -0.07], 0.022, 0.016, antl);
  bone(head, [0.12, 0.28, -0.07], [0.12, 0.52, 0.04], 0.016, 0.01, antl);
  bone(head, [0.12, 0.28, -0.07], [0.22, 0.45, 0.12], 0.012, 0.006, antl, 4);
  bone(head, [0.12, 0.52, 0.04], [0.1, 0.74, 0.1], 0.01, 0.005, antl, 4);
  bone(head, [0.12, 0.52, 0.04], [0.21, 0.67, -0.05], 0.01, 0.005, antl, 4);
  bone(head, [-0.045, 0.06, -0.02], [-0.09, 0.3, 0.02], 0.022, 0.014, antl);
  const q = [-0.09, 0.3, 0.02];
  bone(head, q, [-0.27, 0.5, 0.1], 0.012, 0.004, antl, 4);
  bone(head, q, [-0.19, 0.6, 0.08], 0.012, 0.004, antl, 4);
  bone(head, q, [-0.09, 0.66, 0.07], 0.012, 0.004, antl, 4);
  bone(head, q, [0.0, 0.58, 0.05], 0.012, 0.004, antl, 4);
  bone(head, q, [-0.01, 0.46, 0.11], 0.011, 0.004, antl, 4);

  const tail = pivot(body, 0, 0.12, -0.2); tail.rotation.x = -0.6; J.tail = rig.add(tail);
  add(tail, stalkGeo(0.05, 0.02, 0.22, 5), fur);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  function legPose(i, base, d0, d1, d2, d3) {
    const l = J.leg[i];
    P(l[0], d0); P(l[1], d1); P(l[2], d2); P(l[3], d3);
  }

  function animate(anim, t, dt, speed) {
    const sp = speed || 0;
    const L = anim === 'frozen' ? 0 : 1;
    let a = anim;
    if (!a || a === 'frozen' || a === 'fly') a = 'idle';
    if (a === 'crawl') a = 'walk';
    rig.reset();
    let rate = 8;
    let bRx = 0, bRy = 0, bRz = 0, bPy = 0;
    let n1a = 0.8, n2a = 0.55, ha = 0.55;       // absolute pitches
    let n1y = 0, n2y = 0, hy = 0, hz = 0, jaw = 0.2;
    // per-leg deltas: [d0,d1,d2,d3] x 4 stored flat
    let d = 0;
    let l0 = 0, l1 = 0, l2 = 0, l3 = 0;
    let earT = 0;

    if (a === 'idle' || a === 'special') {
      // the creepy stare: body turned away, head swung round too far and tilted
      bRy = -0.45; n1y = 0.55; n2y = 0.5; hy = 0.2; hz = 0.32;
      bRx = 0.02;
      jaw = 0.24;
      if (a === 'special') {
        rate = 16;
        const s = Math.sin(t * 40);
        hz += 0.12 * s; jaw = 0.8 + 0.1 * s; n2a += 0.1; bPy = 0.01 * s;
      } else {
        n2y += 0.06 * Math.sin(t * 0.5) * L;
        jaw += 0.04 * Math.sin(t * 0.9) * L;
        const k = Math.floor(t * 1.3);
        if (hash1(k) > 0.8) { hz += 0.12 * L; hy += 0.1 * L; }
        earT = L * (hash1(Math.floor(t * 2.1) + 3) > 0.8 ? 0.4 : 0);
      }
      // one foreleg raised, bent wrong
      for (let i = 0; i < 4; i++) {
        if (i === 2) legPose(i, 0, -1.0, 1.7, -1.3, 0.9);
        else legPose(i, 0, 0, 0, 0, 0);
      }
    } else if (a === 'walk') {
      rate = 26;
      const qn = Math.floor(t * 4.5);
      const ph = qn * 0.85;
      bPy = (qn % 2) * 0.03;
      bRy = (hash1(qn) - 0.5) * 0.25;
      n1y = (hash1(qn + 7) - 0.5) * 0.7;
      hz = (hash1(qn + 11) - 0.5) * 0.4;
      n1a = 1.0; n2a = 0.85; ha = 0.8; jaw = 0.25 + 0.15 * (qn % 3);
      for (let i = 0; i < 4; i++) {
        const g = Math.sin(ph * (1 + 0.13 * i) + i * 2.3) * 0.55;
        legPose(i, 0, g, -g * 0.9 + 0.2 * Math.sin(ph * 1.7 + i), g * 0.6, -g * 0.4);
      }
      earT = (qn % 2) * 0.3;
    } else if (a === 'run') {
      rate = 17;
      const j = Math.floor(t * 6);
      const h = hash1(j);
      bRx = 0.08 * Math.sin(t * 9.5);
      bPy = 0.1 * Math.abs(Math.sin(t * 10));
      n1a = 1.15; n2a = 1.0; ha = 0.75; jaw = 0.5;
      if (h > 0.76) {
        bRy = (hash1(j + 3) - 0.5) * 0.9; bRz = (hash1(j + 5) - 0.5) * 0.5; bPy += 0.12;
        hz = (hash1(j + 9) - 0.5) * 1.1; n1y = (hash1(j + 13) - 0.5) * 0.8;
      }
      const f = 1 + sp * 0.02;
      for (let i = 0; i < 4; i++) {
        const p = t * FR[i] * f;
        legPose(i, 0, 1.0 * Math.sin(p), 0.9 * Math.sin(p - 0.9), 0.8 * Math.sin(p * 1.13 + 1.1), 0.6 * Math.sin(p * 0.9 - 2));
      }
      earT = 0.6;
    } else if (a === 'attack') {
      rate = 12;
      bRx = -1.1 + 0.1 * Math.sin(t * 6);
      bPy = 0.0;
      n1a = 1.9; n2a = 2.3; ha = 0.9;
      n2y = 0.12 * Math.sin(t * 14); hz = 0.1 * Math.sin(t * 11);
      jaw = 0.95 + 0.1 * Math.sin(t * 17);
      for (let i = 0; i < 4; i++) {
        if (i < 2) legPose(i, 0, 1.1, 0, 0, 0);
        else legPose(i, 0, 1.1 + 0.25 * Math.sin(t * 3 + i), 0.5 + 0.3 * Math.sin(t * 2.3 + i), 0.3 * Math.sin(t * 2.9 + i * 2), 0.2 * Math.sin(t * 3.7));
      }
      earT = 0.8;
    }

    P(J.body, bRx, bRy, bRz, 0, bPy, 0);
    P(J.n1, n1a - bRx, n1y, 0);
    P(J.n2, n2a - n1a, n2y, 0);
    P(J.head, ha - n2a, hy, hz);
    P(J.jaw, jaw - 0.0, 0, 0);
    P(J.ear[0], earT, 0, 0);
    P(J.ear[1], earT, 0, 0);
    P(J.tail, 0.3 * Math.sin(t * (a === 'run' ? 14 : 1.2)) * L);
    rig.apply(dt, rate);
  }

  return { group, height: 2.3, eyeHeight: 1.78, animate };
}
