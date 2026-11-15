// Dogman — ~2.3 m upright canine: digitigrade legs, deep chest, hunched shoulders, shaggy wolf head.
import * as THREE from 'three';
import {
  seed, rr, tw, canvasTex, fillBase, blotches, strokes, stdMat, eyeMat, mk, limbGeo, coneGeo,
  Merger, shaggy, eyeMesh, Rig,
} from './_helpersA.js';

export function build() {
  seed(4242);
  const group = new THREE.Group();
  const rig = new Rig();

  // ---------- materials (2) ----------
  const furTex = canvasTex(128, (g, s) => {
    fillBase(g, s, '#3d372f');
    blotches(g, s, ['#2a2520', '#57503f', '#1c1815', '#6b6250'], 120, 4, 18, 0.35);
    strokes(g, s, ['#161310', '#74694f', '#2e2924'], 260, 22, 1.3, 0.4, Math.PI / 2, 0.25);
  }, 2, 2);
  const fur = new THREE.MeshStandardMaterial({ map: furTex, vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  const eyeM = eyeMat(0xffd21c);

  const sph = new THREE.SphereGeometry(1, 8, 6);
  const FUR = [0x4a4338, 0x2e2924, 0x6b6250, 0x1c1815];
  const TOOTH = 0xece6d2, CLAW = 0x151210, GUM = 0x3a0e0e;
  const TH = 0.46, SH = 0.46, ME = 0.4;

  // ---------- hierarchy ----------
  const hips = rig.add(group, 0, 1.15, 0);
  {
    const m = new Merger(0.15);
    m.add(sph, 0, 0, -0.02, 0, 0, 0, 0.2, 0.16, 0.18);
    shaggy(m, { rx: 0.2, ry: 0.16, rz: 0.18, n: 18, len: 0.25, w: 0.06, dy: -1, dz: -0.4, color: FUR });
    mk(hips, m.build(), fur);
  }
  const hipJ = [], kneeJ = [], hockJ = [], pawJ = [];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const hj = rig.add(hips, s * 0.19, -0.04, 0);
    {
      const m = new Merger(0.15);
      m.add(limbGeo(TH, 0.15, 0.07, { prof: [1.2, 1.25, 1.0, 0.85, 1.0], rs: 7, jag: 0.05 }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0xffffff);
      shaggy(m, { cy: -0.22, rx: 0.12, ry: 0.22, rz: 0.12, n: 16, len: 0.22, w: 0.055, dy: -1, dz: -0.1, color: FUR });
      mk(hj, m.build(), fur);
    }
    const kj = rig.add(hj, 0, -TH, 0);
    {
      const m = new Merger(0.15);
      m.add(limbGeo(SH, 0.07, 0.045, { prof: [1.3, 1.0, 0.85, 0.85, 1.1], jag: 0.05 }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0xffffff);
      shaggy(m, { cy: -0.2, rx: 0.07, ry: 0.2, rz: 0.07, n: 9, len: 0.17, w: 0.045, dy: -1, dz: -0.3, color: FUR });
      mk(kj, m.build(), fur);
    }
    const hk = rig.add(kj, 0, -SH, 0);
    {
      const m = new Merger(0.15);
      m.add(limbGeo(ME, 0.048, 0.03, { prof: [1.5, 0.9, 0.8, 0.85, 1.2], hs: 4 }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0xffffff);
      shaggy(m, { cy: -0.1, cz: -0.02, rx: 0.045, ry: 0.12, rz: 0.04, n: 5, len: 0.12, w: 0.04, dy: -0.6, dz: -0.8, color: FUR });
      mk(hk, m.build(), fur);
    }
    const pj = rig.add(hk, 0, -ME, 0);
    {
      const m = new Merger(0.12);
      m.add(sph, 0, 0, 0.04, 0, 0, 0, 0.04, 0.03, 0.09, 0x2a2520);
      const toe = coneGeo(0.016, 0.1, 4); toe.rotateX(Math.PI / 2);
      const claw = coneGeo(0.009, 0.07, 4); claw.rotateX(Math.PI / 2);
      for (let k = -1; k <= 1; k++) {
        m.add(toe, k * 0.035, -0.01, 0.1, 0.1, k * 0.15, 0, 1, 1, 1, 0x2a2520);
        m.add(claw, k * 0.04, -0.02, 0.2, 0.2, k * 0.15, 0, 1, 1, 1, CLAW);
      }
      mk(pj, m.build(), fur);
    }
    hipJ.push(hj); kneeJ.push(kj); hockJ.push(hk); pawJ.push(pj);
  }

  // torso: long waist, very deep chest, hunched shoulders
  const spine = rig.add(hips, 0, 0.06, 0);
  {
    const m = new Merger(0.15);
    m.add(limbGeo(0.45, 0.17, 0.2, { up: true, rs: 7, prof: [0.9, 0.9, 1, 1.05, 1.1] }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0xffffff);
    shaggy(m, { cy: 0.22, rx: 0.19, ry: 0.22, rz: 0.17, n: 20, len: 0.24, w: 0.06, dy: -1, dz: -0.5, color: FUR });
    mk(spine, m.build(), fur);
  }
  const chest = rig.add(spine, 0, 0.45, 0);
  {
    const m = new Merger(0.15);
    m.add(sph, 0, 0.25, 0.04, 0, 0, 0, 0.3, 0.34, 0.3, 0xffffff);     // barrel chest
    m.add(sph, 0, 0.5, -0.12, 0, 0, 0, 0.3, 0.16, 0.22, 0x4a4338);    // hump
    shaggy(m, { cy: 0.28, cz: 0.02, rx: 0.3, ry: 0.36, rz: 0.3, n: 46, len: 0.3, w: 0.07, dy: -1, dz: -0.3, color: FUR, out: 0.6 });
    shaggy(m, { cy: 0.5, cz: -0.12, rx: 0.3, ry: 0.16, rz: 0.22, n: 22, len: 0.34, w: 0.06, dy: -0.4, dz: -1, color: FUR, out: 0.8 });
    mk(chest, m.build(), fur);
  }

  const neck = rig.add(chest, 0, 0.46, 0.1);
  {
    const m = new Merger(0.15);
    m.add(limbGeo(0.3, 0.13, 0.1, { up: true, rs: 7 }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0xffffff);
    shaggy(m, { cy: 0.14, rx: 0.14, ry: 0.15, rz: 0.14, n: 26, len: 0.34, w: 0.075, dy: -0.8, dz: -0.8, color: FUR, out: 0.7 });
    mk(neck, m.build(), fur);
  }
  const head = rig.add(neck, 0, 0.3, 0.02);
  {
    const m = new Merger(0.15);
    m.add(sph, 0, 0, 0, 0, 0, 0, 0.12, 0.11, 0.15, 0xffffff);                  // cranium
    const sn = new THREE.CylinderGeometry(0.04, 0.078, 0.42, 6, 2); sn.rotateX(Math.PI / 2);
    m.add(sn, 0, -0.03, 0.3, 0.06, 0, 0, 1, 0.92, 1, 0x4a4338);                // long muzzle
    m.add(sph, 0, -0.045, 0.51, 0, 0, 0, 0.045, 0.036, 0.04, 0x0b0908);        // nose
    for (const s of [-1, 1]) {
      m.add(sph, s * 0.065, 0.075, 0.1, 0, 0, 0, 0.05, 0.03, 0.06, 0x2a2520);  // heavy brow
      m.add(sph, s * 0.07, -0.058, 0.3, 0, 0, 0, 0.012, 0.02, 0.12, GUM);      // snarl lip gap
    }
    const tooth = coneGeo(0.0085, 0.04, 4); tooth.rotateX(Math.PI);
    const fang = coneGeo(0.014, 0.075, 4); fang.rotateX(Math.PI);
    for (let i = 0; i < 7; i++) {
      const z = 0.14 + i * 0.058, r = 0.078 - (z - 0.09) / 0.42 * 0.036;
      for (const s of [-1, 1]) m.add(i === 5 ? fang : tooth, s * r * 0.85, -0.03 - r * 0.9, z, 0, 0, 0, 1, 1, 1, TOOTH);
    }
    for (const s of [-1, 1]) m.add(tooth, s * 0.02, -0.095, 0.505, 0, 0, 0, 1, 1, 1, TOOTH);
    shaggy(m, { cy: -0.01, cz: -0.06, rx: 0.12, ry: 0.11, rz: 0.12, n: 20, len: 0.2, w: 0.05, dy: -0.6, dz: -1, color: FUR, out: 0.8 });
    mk(head, m.build(), fur);
  }
  const jaw = rig.add(head, 0, -0.07, 0.03);
  {
    const m = new Merger(0.15);
    m.add(limbGeo(0.4, 0.05, 0.026, { z: true, rs: 6, hs: 2 }), 0, -0.01, 0.0, 0, 0, 0, 1, 0.8, 1, 0x4a4338);
    m.add(sph, 0, -0.01, 0.0, 0, 0, 0, 0.06, 0.045, 0.06, 0x3a342c);
    const tooth = coneGeo(0.008, 0.038, 4), fang = coneGeo(0.013, 0.07, 4);
    for (let i = 0; i < 6; i++) {
      const z = 0.12 + i * 0.05;
      for (const s of [-1, 1]) m.add(i === 5 ? fang : tooth, s * (0.04 - i * 0.004), 0.01, z, 0, 0, 0, 1, 1, 1, TOOTH);
    }
    mk(jaw, m.build(), fur);
  }
  const earJ = [];
  for (const s of [-1, 1]) {
    const e = rig.add(head, s * 0.075, 0.1, -0.05);
    const m = new Merger(0.2);
    m.add(coneGeo(0.06, 0.24, 4), 0, 0, 0, -0.1, 0, 0, 1, 1, 0.45, 0x3a342c);
    m.add(coneGeo(0.03, 0.14, 4), 0, 0.02, 0.012, -0.1, 0, 0, 1, 1, 0.3, 0x8a6a60);
    mk(e, m.build(), fur);
    earJ.push(e);
  }
  for (const s of [-1, 1]) eyeMesh(head, eyeM, 0.0135, s * 0.077, 0.048, 0.128);

  // arms: heavy, hands with long dark claws
  const shJ = [], elJ = [], wrJ = [], fiJ = [];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const sh = rig.add(chest, s * 0.3, 0.42, 0);
    {
      const m = new Merger(0.15);
      m.add(limbGeo(0.5, 0.1, 0.06, { prof: [1.3, 1.1, 0.9, 0.85, 1.15], rs: 7 }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0xffffff);
      shaggy(m, { cy: -0.24, rx: 0.09, ry: 0.24, rz: 0.09, n: 14, len: 0.26, w: 0.06, dy: -1, dz: -0.2, color: FUR });
      mk(sh, m.build(), fur);
    }
    const el = rig.add(sh, 0, -0.5, 0);
    {
      const m = new Merger(0.15);
      m.add(limbGeo(0.5, 0.06, 0.04, { prof: [1.3, 1.0, 0.85, 0.85, 1.15] }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0xffffff);
      shaggy(m, { cy: -0.22, rx: 0.06, ry: 0.22, rz: 0.06, n: 9, len: 0.2, w: 0.05, dy: -1, dz: -0.3, color: FUR });
      mk(el, m.build(), fur);
    }
    const wr = rig.add(el, 0, -0.5, 0);
    {
      const m = new Merger(0.12);
      m.add(sph, 0, -0.05, 0, 0, 0, 0, 0.055, 0.075, 0.04, 0x2a2520);
      mk(wr, m.build(), fur);
    }
    const fi = rig.add(wr, 0, -0.1, 0);
    {
      const m = new Merger(0.12);
      const f1 = coneGeo(0.016, 0.1, 4); f1.rotateX(Math.PI);
      const cl = coneGeo(0.009, 0.1, 4);
      for (let k = 0; k < 4; k++) {
        const x = (k - 1.5) * 0.034, bend = 0.55 + rr(-0.1, 0.15);
        m.add(f1, x, 0, 0, 0, 0, 0, 1, 1, 1, 0x2a2520);
        m.add(cl, x, -0.1, 0, Math.PI - bend, 0, 0, 1, 1, 1, CLAW);
      }
      m.add(cl, s * 0.06, -0.01, 0.02, Math.PI - 0.7, 0, s * 0.5, 1, 1, 1, CLAW);
      mk(fi, m.build(), fur);
    }
    shJ.push(sh); elJ.push(el); wrJ.push(wr); fiJ.push(fi);
  }

  const tail = rig.add(hips, 0, 0.0, -0.16);
  {
    const m = new Merger(0.15);
    m.add(limbGeo(0.6, 0.06, 0.03, { rs: 5, hs: 3, prof: [1, 1.5, 1.8, 1.5, 0.9] }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0xffffff);
    shaggy(m, { cy: -0.3, rx: 0.08, ry: 0.3, rz: 0.08, n: 14, len: 0.2, w: 0.06, dy: -1, dz: 0, color: FUR });
    mk(tail, m.build(), fur);
  }

  // ---------- animation ----------
  let ph = 0;
  const legExt = (hp, th, kn, hk) => TH * Math.cos(hp + th) + SH * Math.cos(hp + th + kn) + ME * Math.cos(hp + th + kn + hk);

  function animate(anim, t, dt, speed) {
    if (anim === 'frozen') return;
    dt = dt > 0.1 ? 0.1 : dt > 0 ? dt : 0;
    speed = speed || 0;
    let a = anim;
    if (a === 'crawl') a = 'walk';
    else if (a !== 'walk' && a !== 'run' && a !== 'attack' && a !== 'special') a = 'idle';

    const br = Math.sin(t * (a === 'run' ? 9 : a === 'idle' ? 1.7 : 2.6));
    const heave = a === 'run' ? 0.05 : a === 'idle' ? 0.035 : 0.03;
    chest.g.scale.set(1 + heave * 0.6 * br, 1 + heave * 0.4 * br, 1 + heave * br);
    let jawOpen = 0.12;
    let curl = 0.35;
    let rate = 9;
    let earBase = 0.15, earFlick = tw(t, 1.9) * 0.7;
    const ekL = Math.sin(t * 0.7) * 0.05, ekR = Math.cos(t * 0.6) * 0.05;

    if (a === 'walk') {
      // upright prowl
      ph += dt * (2.6 + speed * 0.6);
      const s = Math.sin(ph), c = Math.cos(ph);
      hips.r(0.08, s * 0.1, s * 0.05);
      spine.r(0.4, -s * 0.12, 0);
      chest.r(0.28, -s * 0.12, 0);
      neck.r(0.2, Math.sin(t * 0.8) * 0.12, 0);
      head.r(-0.35 + 0.05 * Math.sin(ph * 2), Math.sin(t * 0.7) * 0.15, 0);
      hipJ[0].r(-0.75 - s * 0.45, 0, 0.02); hipJ[1].r(-0.75 + s * 0.45, 0, -0.02);
      const lL = Math.max(0, c), lR = Math.max(0, -c);
      kneeJ[0].r(1.6 + lL * 0.5, 0, 0); kneeJ[1].r(1.6 + lR * 0.5, 0, 0);
      hockJ[0].r(-1.1 + lL * 0.7, 0, 0); hockJ[1].r(-1.1 + lR * 0.7, 0, 0);
      shJ[0].r(0.1 + s * 0.35, 0, -0.1); shJ[1].r(0.1 - s * 0.35, 0, 0.1);
      elJ[0].r(-0.45 - 0.2 * Math.max(0, -s), 0, 0); elJ[1].r(-0.45 - 0.2 * Math.max(0, s), 0, 0);
      jawOpen = 0.2 + 0.1 * Math.sin(t * 3);
      earBase = 0.0;
    } else if (a === 'run') {
      // bounding gallop on all fours
      ph += dt * (6.2 + speed * 0.25);
      const s = Math.sin(ph), c = Math.cos(ph);
      hips.r(0.5 + 0.1 * s, 0, 0);
      spine.r(0.5 + 0.22 * Math.sin(ph + 0.6), s * 0.05, 0);
      chest.r(0.3 + 0.12 * Math.sin(ph + 1.0), 0, 0);
      neck.r(-0.65, 0, 0);
      head.r(-0.2 + 0.1 * Math.sin(ph + 1.5), 0, 0);
      hipJ[0].r(-1.0 - 0.6 * s, 0, 0.04); hipJ[1].r(-1.0 - 0.6 * Math.sin(ph + 0.25), 0, -0.04);
      const lk = Math.max(0, c);
      kneeJ[0].r(1.8 + lk * 0.6, 0, 0); kneeJ[1].r(1.8 + Math.max(0, Math.cos(ph + 0.25)) * 0.6, 0, 0);
      hockJ[0].r(-1.35 + lk * 0.6, 0, 0); hockJ[1].r(-1.35 + Math.max(0, Math.cos(ph + 0.25)) * 0.6, 0, 0);
      const fw = Math.sin(ph - 1.3), fw2 = Math.sin(ph - 1.15);
      shJ[0].r(-0.85 - 0.8 * fw, 0, -0.12); shJ[1].r(-0.85 - 0.8 * fw2, 0, 0.12);
      elJ[0].r(-0.25 - Math.max(0, Math.cos(ph - 1.3)) * 0.6, 0, 0); elJ[1].r(-0.25 - Math.max(0, Math.cos(ph - 1.15)) * 0.6, 0, 0);
      jawOpen = 0.45 + 0.15 * Math.sin(ph * 2);
      curl = -0.15;
      earBase = -0.5;
      earFlick = 0;
      rate = 12;
    } else if (a === 'attack') {
      const q = Math.sin(t * 15) * 0.03;
      hips.r(0.2, 0, 0);
      spine.r(0.65 + q, 0, 0);
      chest.r(0.4, 0, 0);
      neck.r(-0.3, 0, 0);
      head.r(-0.35, 0, 0);
      hipJ[0].r(-0.95, 0, 0.05); hipJ[1].r(-0.45, 0, -0.05);
      kneeJ[0].r(1.9, 0, 0); kneeJ[1].r(1.5, 0, 0);
      hockJ[0].r(-1.3, 0, 0); hockJ[1].r(-0.9, 0, 0);
      shJ[0].r(-1.85 + q, 0, -0.3); shJ[1].r(-1.8 - q, 0, 0.3);
      elJ[0].r(-0.2, 0, 0); elJ[1].r(-0.25, 0, 0);
      jawOpen = 1.0;
      curl = -0.4;
      earBase = -0.7;
      earFlick = 0;
      rate = 14;
    } else if (a === 'special') {
      // howl
      const q = Math.sin(t * 6) * 0.03;
      hips.r(0.0, 0, 0);
      spine.r(0.05, 0, 0);
      chest.r(-0.15 + q, 0, 0);
      neck.r(-0.55, 0, 0);
      head.r(-0.75, 0, 0);
      hipJ[0].r(-0.7, 0, 0.05); hipJ[1].r(-0.7, 0, -0.05);
      kneeJ[0].r(1.5, 0, 0); kneeJ[1].r(1.5, 0, 0);
      hockJ[0].r(-0.95, 0, 0); hockJ[1].r(-0.95, 0, 0);
      shJ[0].r(0.05, 0, -0.25); shJ[1].r(0.05, 0, 0.25);
      elJ[0].r(-0.4, 0, 0); elJ[1].r(-0.4, 0, 0);
      jawOpen = 0.55 + 0.05 * Math.sin(t * 5);
      earBase = -0.3;
      earFlick = 0;
    } else {
      // idle: sniffing, ears flicking, chest heaving
      const sn = Math.max(0, Math.sin(t * 0.45)), fast = Math.sin(t * 13) * sn;
      const sw = Math.sin(t * 0.5);
      hips.r(0.06, 0, sw * 0.03);
      spine.r(0.5, sw * 0.04, 0);
      chest.r(0.3 + 0.02 * br, Math.sin(t * 0.3) * 0.1, 0);
      neck.r(0.12 + sn * 0.2, Math.sin(t * 0.37) * 0.35, 0);
      head.r(-0.4 + sn * 0.2 + fast * 0.05, Math.sin(t * 0.29 + 1) * 0.3, Math.sin(t * 0.43) * 0.1);
      hipJ[0].r(-0.75, 0, 0.03); hipJ[1].r(-0.75, 0, -0.03);
      kneeJ[0].r(1.6, 0, 0); kneeJ[1].r(1.6, 0, 0);
      hockJ[0].r(-1.1, 0, 0); hockJ[1].r(-1.1, 0, 0);
      shJ[0].r(0.1 + 0.03 * br, 0, -0.1); shJ[1].r(0.1 + 0.03 * br, 0, 0.1);
      elJ[0].r(-0.4, 0, 0); elJ[1].r(-0.4, 0, 0);
      jawOpen = 0.16 + fast * 0.04 + tw(t, 0.8) * 0.2;
    }
    jaw.r(jawOpen, 0, 0);
    earJ[0].r(-0.1 + earBase * 0.5 - earFlick * 0.6 + ekL, 0, -0.25 - earBase * 0.5 - earFlick * 0.4);
    earJ[1].r(-0.1 + earBase * 0.5 - tw(t, 1.6, 4) * 0.6 + ekR, 0, 0.25 + earBase * 0.5 + tw(t, 1.6, 4) * 0.4);
    for (let i = 0; i < 2; i++) {
      fiJ[i].r(curl + 0.2 * Math.sin(t * 2.1 + i * 1.9) + tw(t, 2.5, i * 3) * 0.5, 0, 0);
      wrJ[i].r(0.1 * Math.sin(t * 1.2 + i), 0, 0);
    }
    tail.r(0.7 + (a === 'run' ? 0.5 : 0.1) * Math.sin(ph) + 0.1 * Math.sin(t * 1.3), 0.25 * Math.sin(t * 0.8), 0);

    rig.step(dt, rate);

    const hp = hips.g.rotation.x;
    const e0 = legExt(hp, hipJ[0].g.rotation.x, kneeJ[0].g.rotation.x, hockJ[0].g.rotation.x);
    const e1 = legExt(hp, hipJ[1].g.rotation.x, kneeJ[1].g.rotation.x, hockJ[1].g.rotation.x);
    hips.g.position.y = Math.max(e0, e1) + 0.1;
    for (let i = 0; i < 2; i++) {
      const cum = hp + hipJ[i].g.rotation.x + kneeJ[i].g.rotation.x + hockJ[i].g.rotation.x;
      pawJ[i].g.rotation.x = -cum + 0.1;
    }
  }

  animate('idle', 0, 0, 0);
  return { group, height: 2.3, eyeHeight: 2.05, animate };
}
