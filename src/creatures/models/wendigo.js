// Wendigo — ~3.1 m emaciated giant, deer-skull head with wide antlers, hands below the knees.
import * as THREE from 'three';
import {
  seed, rnd, rr, tw, canvasTex, fillBase, blotches, strokes, stdMat, eyeMat, mk, limbGeo, coneGeo,
  stripGeo, Merger, shaggy, eyeMesh, Rig,
} from './_helpersA.js';

export function build() {
  seed(31337);
  const group = new THREE.Group();
  const rig = new Rig();

  // ---------- materials (4) ----------
  const skinTex = canvasTex(128, (g, s) => {
    fillBase(g, s, '#6b6458');
    blotches(g, s, ['#4a4339', '#8c8474', '#2f2824', '#5a4c40'], 140, 4, 18, 0.32);
    strokes(g, s, ['#231d1a', '#9a9282'], 80, 22, 1.2, 0.28, Math.PI / 2, 0.6);
  }, 1.5, 1.5);
  const boneTex = canvasTex(128, (g, s) => {
    fillBase(g, s, '#cbc2aa');
    blotches(g, s, ['#a49a82', '#e2dac4', '#6e5f45'], 120, 3, 14, 0.3);
    strokes(g, s, ['#4b3f2e'], 40, 16, 1, 0.35, Math.PI / 2, 0.8);
  }, 1, 1);
  const skin = new THREE.MeshStandardMaterial({ map: skinTex, vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
  const bone = new THREE.MeshStandardMaterial({ map: boneTex, vertexColors: true, roughness: 0.65, metalness: 0, flatShading: true });
  const dark = stdMat({ color: 0x17120f, roughness: 1, side: THREE.DoubleSide });
  const eyeM = eyeMat(0xe6efff);

  const sph = new THREE.SphereGeometry(1, 8, 6);
  const beam = new THREE.CylinderGeometry(0.7, 1, 1, 5, 1);
  beam.translate(0, 0.5, 0);

  // ---------- hierarchy ----------
  const hips = rig.add(group, 0, 1.48, 0);
  {
    const m = new Merger(0.15);
    m.add(sph, 0, 0, 0, 0, 0, 0, 0.21, 0.13, 0.14);
    m.add(sph, -0.2, 0.07, 0.0, 0, 0, 0, 0.06);
    m.add(sph, 0.2, 0.07, 0.0, 0, 0, 0, 0.06);
    shaggy(m, { cy: -0.02, rx: 0.2, ry: 0.12, rz: 0.13, n: 10, len: 0.28, w: 0.04, dy: -1, dz: 0, color: 0x3a322b, out: 0.6 });
    mk(hips, m.build(), skin);
  }

  // legs
  const hipJ = [], kneeJ = [], ankJ = [];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const hj = rig.add(hips, s * 0.2, -0.04, 0);
    mk(hj, limbGeo(0.72, 0.1, 0.06, { prof: [1.2, 1.1, 0.8, 0.85, 1.25], jag: 0.08 }), skin);
    const kj = rig.add(hj, 0, -0.72, 0);
    mk(kj, limbGeo(0.7, 0.06, 0.04, { prof: [1.5, 0.9, 0.75, 0.8, 1.3], jag: 0.1 }), skin);
    const aj = rig.add(kj, 0, -0.7, 0);
    const fm = new Merger(0.15);
    fm.add(sph, 0, 0.0, 0.0, 0, 0, 0, 0.05, 0.04, 0.07);
    fm.add(sph, 0, -0.005, 0.12, 0, 0, 0, 0.045, 0.03, 0.12);
    const toe = coneGeo(0.02, 0.26, 4); toe.rotateX(Math.PI / 2);
    for (let k = -1; k <= 1; k++) fm.add(toe, k * 0.04, -0.01, 0.2, 0.15, k * 0.12, 0, 1, 1, 1, 0x3b342c);
    const heel = coneGeo(0.025, 0.12, 4); heel.rotateX(-Math.PI / 2);
    fm.add(heel, 0, 0, -0.03, 0.2, 0, 0);
    mk(aj, fm.build(), skin, 0, 0.0, 0);
    hipJ.push(hj); kneeJ.push(kj); ankJ.push(aj);
  }

  // spine / chest
  const spine = rig.add(hips, 0, 0.08, 0);
  mk(spine, limbGeo(0.42, 0.125, 0.1, { up: true, rs: 7, prof: [1.1, 0.9, 0.8, 0.88, 1.1], jag: 0.05 }), skin);
  const chest = rig.add(spine, 0, 0.42, 0);
  {
    const m = new Merger(0.14);
    m.add(sph, 0, 0.3, 0, 0, 0, 0, 0.18, 0.3, 0.12);          // sunken chest wall
    m.add(sph, -0.34, 0.5, 0, 0, 0, 0, 0.075);                 // shoulder balls
    m.add(sph, 0.34, 0.5, 0, 0, 0, 0, 0.075);
    m.add(sph, 0, 0.56, -0.09, 0, 0, 0, 0.2, 0.09, 0.1);        // hunched trapezius
    shaggy(m, { cy: 0.4, cz: -0.02, rx: 0.2, ry: 0.28, rz: 0.13, n: 14, len: 0.3, w: 0.035, dy: -1, dz: -0.2, color: 0x2e2824, yMin: 0 });
    mk(chest, m.build(), skin);

    const mr = new Merger(0.12);
    const rib = new THREE.TorusGeometry(1, 0.06, 4, 11, Math.PI * 2 - 0.6);
    rib.rotateZ(Math.PI / 2 + 0.3); rib.rotateX(Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const y = 0.06 + i * 0.072, f = Math.sin(Math.PI * (i + 1.4) / 9.8);
      mr.add(rib, 0, y, 0.0, 0.05, 0, 0, 0.17 + 0.1 * f, 0.27, 0.11 + 0.055 * f, 0xffffff);
    }
    mr.add(new THREE.BoxGeometry(0.03, 0.5, 0.02), 0, 0.3, 0.138, 0, 0, 0, 1, 1, 1);
    for (let i = 0; i < 15; i++) {
      const y = -0.42 + i * 0.07;
      const z = y < 0 ? -0.112 : -0.1 - 0.045 * Math.sin(Math.min(1, y / 0.6) * 2.2);
      mr.add(sph, 0, y, z, 0, 0, 0, 0.02 + (i % 2) * 0.006, 0.02, 0.026);
    }
    // collarbones
    for (const s of [-1, 1]) mr.addDir(beam, s * 0.03, 0.57, 0.07, s * 1, 0.12, -0.25, 0.012, 0.3, 0.012);
    mk(chest, mr.build(), bone);
  }

  // neck + head
  const neck = rig.add(chest, 0, 0.62, -0.03);
  mk(neck, limbGeo(0.42, 0.058, 0.045, { up: true, jag: 0.1, prof: [1.2, 0.85, 0.8, 0.9, 1.1] }), skin);
  const head = rig.add(neck, 0, 0.42, 0);
  {
    const m = new Merger(0.14);
    m.add(sph, 0, 0.0, 0.0, 0, 0, 0, 0.125, 0.14, 0.17);        // cranium
    const sn = new THREE.CylinderGeometry(0.03, 0.07, 0.4, 6, 3); sn.rotateX(Math.PI / 2);
    m.add(sn, 0, -0.035, 0.3, 0.08, 0, 0);
    m.add(sph, 0, -0.06, 0.5, 0, 0, 0, 0.04, 0.035, 0.04, 0x140f0c);
    for (const s of [-1, 1]) {
      m.add(sph, s * 0.085, 0.085, 0.1, 0, 0, 0, 0.05, 0.03, 0.06);        // brow
      m.add(sph, s * 0.085, 0.03, 0.105, 0, 0, 0, 0.042, 0.05, 0.05, 0x050403); // socket
      m.add(sph, s * 0.07, -0.04, 0.15, 0, 0, 0, 0.03, 0.03, 0.08);        // cheek
      m.add(sph, s * 0.02, -0.052, 0.485, 0, 0, 0, 0.012, 0.012, 0.014, 0x050403);
    }
    const tooth = coneGeo(0.009, 0.05, 4); tooth.rotateX(Math.PI);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) m.add(tooth, s * 0.045, -0.075 + i * 0.002, 0.2 + i * 0.045, 0, 0, 0, 1, 1, 1, 0xb8ad90);
    // antlers: wide, curving beams with tines
    for (const s of [-1, 1]) {
      let x = s * 0.07, y = 0.12, z = -0.04, a = 1.38;
      for (let i = 0; i < 7; i++) {
        const len = 0.135 - 0.004 * i, r = 0.03 - 0.0035 * i;
        const dx = s * Math.sin(a), dy = Math.cos(a) * 0.55 + 0.04, dz = -0.1 + i * 0.045;
        const n = Math.hypot(dx, dy, dz);
        m.addDir(beam, x, y, z, dx, dy, dz, r, len * 1.12, r, 0xffffff);
        if (i >= 1 && i <= 5) {
          const tl = 0.24 - 0.028 * i;
          m.addDir(beam, x, y, z, s * 0.35, 0.8, 0.5 + i * 0.05, r * 0.7, tl, r * 0.7, 0xe6dcc0);
        }
        x += dx / n * len; y += dy / n * len; z += dz / n * len;
        a -= 0.05 + (i > 3 ? 0.04 : 0);
      }
      m.add(sph, s * 0.07, 0.12, -0.04, 0, 0, 0, 0.04); // burr
    }
    mk(head, m.build(), bone);
  }
  const jaw = rig.add(head, 0, -0.085, 0.02);
  {
    const m = new Merger(0.14);
    const jm = new THREE.CylinderGeometry(0.022, 0.05, 0.34, 5, 2); jm.rotateX(Math.PI / 2);
    m.add(jm, 0, -0.01, 0.19, -0.03, 0, 0, 1.2, 0.7, 1);
    m.add(sph, 0, 0.0, 0.01, 0, 0, 0, 0.07, 0.04, 0.05);
    const tooth = coneGeo(0.008, 0.045, 4);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) m.add(tooth, s * 0.04, 0.0, 0.14 + i * 0.04, 0, 0, 0, 1, 1, 1, 0xb8ad90);
    mk(jaw, m.build(), bone);
  }
  for (const s of [-1, 1]) eyeMesh(head, eyeM, 0.012, s * 0.093, 0.03, 0.157);

  // arms (hands hang below the knees)
  const shJ = [], elJ = [], wrJ = [], fiJ = [];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const sh = rig.add(chest, s * 0.34, 0.5, 0);
    mk(sh, limbGeo(0.8, 0.058, 0.04, { prof: [1.3, 0.95, 0.8, 0.85, 1.35], jag: 0.08 }), skin);
    const el = rig.add(sh, 0, -0.8, 0);
    mk(el, limbGeo(0.85, 0.042, 0.028, { prof: [1.4, 0.9, 0.8, 0.8, 1.2], jag: 0.08 }), skin);
    const wr = rig.add(el, 0, -0.85, 0);
    mk(wr, limbGeo(0.13, 0.034, 0.03, { rs: 5, hs: 1, flat: 0.5 }), skin);
    const fi = rig.add(wr, 0, -0.12, 0);
    const fm = new Merger(0.18), cm = new Merger(0.1);
    const f1 = coneGeo(0.013, 0.2, 5); f1.rotateX(Math.PI);
    const f2 = coneGeo(0.009, 0.15, 5);
    const c1 = coneGeo(0.008, 0.13, 4);
    for (let k = 0; k < 4; k++) {
      const x = (k - 1.5) * 0.026, bend = 0.7 + rr(-0.15, 0.15);
      fm.add(f1, x, 0, 0, 0, 0, 0, 1, 1, 1, 0x4a4238);
      fm.add(f2, x, -0.2, 0, Math.PI - bend, 0, 0, 1, 1, 1, 0x4a4238);
      const tx = x, ty = -0.2 - Math.cos(bend) * 0.15, tz = Math.sin(bend) * 0.15;
      cm.add(c1, tx, ty, tz, Math.PI - bend - 0.15, 0, 0);
    }
    fm.add(f2, s * 0.045, -0.01, 0.03, Math.PI - 0.7, 0, s * 0.4, 1, 1, 1, 0x4a4238); // thumb
    mk(fi, fm.build(), skin);
    mk(fi, cm.build(), dark);
    shJ.push(sh); elJ.push(el); wrJ.push(wr); fiJ.push(fi);
  }

  // tattered hide strips
  const strips = [];
  const stripSpec = [
    [chest, -0.22, 0.52, -0.1, 0.26, 0.85], [chest, 0.18, 0.5, -0.11, 0.22, 0.7],
    [hips, -0.1, -0.02, 0.12, 0.2, 0.75], [hips, 0.12, -0.02, -0.12, 0.22, 0.8],
  ];
  for (const sp of stripSpec) {
    const j = rig.add(sp[0], sp[1], sp[2], sp[3]);
    mk(j, stripGeo(sp[4], sp[5], 3), dark);
    strips.push(j);
  }

  // ---------- animation ----------
  let ph = 0;
  const THIGH = 0.72, SHIN = 0.7;
  const legExt = (hp, th, kn) => THIGH * Math.cos(hp + th) + SHIN * Math.cos(hp + th + kn);

  function animate(anim, t, dt, speed) {
    if (anim === 'frozen') return;
    dt = dt > 0.1 ? 0.1 : dt > 0 ? dt : 0;
    speed = speed || 0;
    let a = anim;
    if (a === 'crawl') a = 'walk';
    else if (a !== 'walk' && a !== 'run' && a !== 'attack' && a !== 'special') a = 'idle';

    const br = Math.sin(t * 1.4);
    chest.g.scale.set(1 + 0.012 * br, 1 + 0.02 * br, 1 + 0.03 * br);
    let jawOpen = 0.05 + tw(t, 1.3) * 0.25;
    let curl = 0.35;
    let rate = 9;

    if (a === 'walk') {
      ph += dt * (2.3 + speed * 0.55);
      const s = Math.sin(ph), c = Math.cos(ph);
      const aL = 0.62, aR = 0.42; // uneven, lurching
      hips.r(0.05, s * 0.16, s * 0.08);
      spine.r(0.3 + 0.05 * Math.sin(ph * 2), -s * 0.13, -s * 0.05);
      chest.r(0.16, -s * 0.16, Math.sin(ph + 1) * 0.04);
      neck.r(0.5, Math.sin(t * 0.4) * 0.15 + s * 0.1, Math.sin(t * 0.5) * 0.08);
      head.r(-0.5 + 0.05 * Math.sin(ph * 2), Math.sin(t * 0.31) * 0.2, Math.sin(t * 0.7) * 0.12 + tw(t, 1.1) * 0.18);
      hipJ[0].r(-s * aL - 0.05, 0, 0.02); hipJ[1].r(s * aR + 0.05, 0, -0.02);
      kneeJ[0].r(0.15 + Math.max(0, c) * 1.0, 0, 0); kneeJ[1].r(0.15 + Math.max(0, -c) * 0.9, 0, 0);
      shJ[0].r(s * 0.3 + 0.05, 0, -0.1); shJ[1].r(-s * 0.3 + 0.05, 0, 0.1);
      elJ[0].r(-0.3 - 0.2 * Math.sin(ph + 1), 0, 0); elJ[1].r(-0.3 + 0.2 * Math.sin(ph + 1), 0, 0);
      jawOpen = 0.08 + tw(t, 1.7) * 0.3;
    } else if (a === 'run') {
      ph += dt * (4.4 + speed * 0.3);
      const s = Math.sin(ph), c = Math.cos(ph);
      hips.r(0.18, s * 0.12, s * 0.06);
      spine.r(0.5 + 0.08 * Math.sin(ph * 2), -s * 0.2, 0);
      chest.r(0.32, -s * 0.2, 0);
      neck.r(0.35, s * 0.1, 0);
      head.r(-0.7, -s * 0.08, Math.sin(ph * 2) * 0.08);
      hipJ[0].r(-s * 0.95 - 0.1, 0, 0.03); hipJ[1].r(s * 0.95 - 0.1, 0, -0.03);
      kneeJ[0].r(0.25 + Math.max(0, c) * 1.55, 0, 0); kneeJ[1].r(0.25 + Math.max(0, -c) * 1.55, 0, 0);
      shJ[0].r(-1.0 + s * 0.85, 0, -0.18); shJ[1].r(-1.0 - s * 0.85, 0, 0.18);
      elJ[0].r(-0.55 - 0.3 * Math.max(0, s), 0, 0); elJ[1].r(-0.55 - 0.3 * Math.max(0, -s), 0, 0);
      jawOpen = 0.35 + 0.1 * Math.sin(ph * 2);
      curl = -0.1;
      rate = 11;
    } else if (a === 'attack') {
      const q = Math.sin(t * 14) * 0.03;
      hips.r(0.1, 0, 0);
      spine.r(0.7 + q, 0, 0);
      chest.r(0.35, 0, 0);
      neck.r(0.2, 0, 0);
      head.r(-0.55, 0, 0);
      hipJ[0].r(-0.75, 0, 0.05); hipJ[1].r(0.45, 0, -0.05);
      kneeJ[0].r(0.7, 0, 0); kneeJ[1].r(0.5, 0, 0);
      shJ[0].r(-1.75 + q, 0, -0.35); shJ[1].r(-1.7 - q, 0, 0.35);
      elJ[0].r(-0.25, 0, 0); elJ[1].r(-0.3, 0, 0);
      jawOpen = 0.95;
      curl = -0.35;
      rate = 14;
    } else if (a === 'special') {
      // throws its head back and mimics a voice
      const q = Math.sin(t * 9) * 0.04;
      hips.r(-0.05, 0, 0);
      spine.r(-0.15, 0, 0);
      chest.r(-0.2 + q, 0, 0);
      neck.r(-0.15, 0, 0);
      head.r(-0.85 + q, Math.sin(t * 0.8) * 0.15, 0);
      hipJ[0].r(-0.08, 0, 0.1); hipJ[1].r(0.08, 0, -0.1);
      kneeJ[0].r(0.2, 0, 0); kneeJ[1].r(0.2, 0, 0);
      shJ[0].r(-0.3, 0, -0.85); shJ[1].r(-0.3, 0, 0.85);
      elJ[0].r(-0.3, 0, 0); elJ[1].r(-0.3, 0, 0);
      jawOpen = 0.9 + 0.1 * Math.sin(t * 7);
      curl = -0.2;
    } else {
      // idle: swaying, tilting, twitching
      const sw = Math.sin(t * 0.55), tv = tw(t, 0.9), tv2 = tw(t, 1.9, 2);
      hips.r(0.03, Math.sin(t * 0.3) * 0.08, sw * 0.05);
      spine.r(0.24 + 0.02 * br, sw * 0.06, -sw * 0.04);
      chest.r(0.14, sw * 0.08, 0);
      neck.r(0.42 + tv * 0.15, Math.sin(t * 0.23) * 0.3, Math.sin(t * 0.37) * 0.1);
      head.r(-0.38 + Math.sin(t * 0.5) * 0.06 + tv2 * 0.12, Math.sin(t * 0.19 + 1) * 0.25 + tv * 0.25, Math.sin(t * 0.33) * 0.2 + tv * 0.12);
      hipJ[0].r(-0.08 + sw * 0.03, 0, 0.03); hipJ[1].r(0.06 - sw * 0.03, 0, -0.03);
      kneeJ[0].r(0.12 + Math.max(0, sw) * 0.08, 0, 0); kneeJ[1].r(0.2 + Math.max(0, -sw) * 0.08, 0, 0);
      shJ[0].r(0.04 + 0.05 * Math.sin(t * 0.6), 0, -0.1 - tv2 * 0.1); shJ[1].r(0.02 + 0.05 * Math.sin(t * 0.6 + 1), 0, 0.1 + tv * 0.1);
      elJ[0].r(-0.18, 0, 0); elJ[1].r(-0.22, 0, 0);
      jawOpen = 0.06 + tv * 0.3;
    }
    jaw.r(jawOpen, 0, 0);
    for (let i = 0; i < 2; i++) {
      const cv = curl + 0.22 * Math.sin(t * 2.3 + i * 1.7) + tw(t, 2.7, i * 3) * 0.5;
      fiJ[i].r(cv, 0, 0);
      wrJ[i].r(0.1 * Math.sin(t * 1.1 + i), 0, 0);
    }
    const sp = a === 'run' ? 0.6 : a === 'walk' ? 0.3 : 0.1;
    for (let i = 0; i < strips.length; i++) {
      strips[i].r(Math.sin(t * 1.9 + i * 1.3) * 0.12 + sp * Math.sin(ph + i), 0, Math.sin(t * 1.4 + i * 2.1) * 0.1);
    }

    rig.step(dt, rate);

    // keep feet planted: hips ride on the lower leg, ankles stay flat
    const hp = hips.g.rotation.x;
    const e0 = legExt(hp, hipJ[0].g.rotation.x, kneeJ[0].g.rotation.x);
    const e1 = legExt(hp, hipJ[1].g.rotation.x, kneeJ[1].g.rotation.x);
    hips.g.position.y = Math.max(e0, e1) + 0.1;
    for (let i = 0; i < 2; i++) {
      const cum = hp + hipJ[i].g.rotation.x + kneeJ[i].g.rotation.x;
      const lift = (i === 0 ? -Math.sin(ph) : Math.sin(ph)) > 0.3 && a !== 'idle' ? 0.25 : 0;
      ankJ[i].g.rotation.x = -cum + lift;
    }
  }

  animate('idle', 0, 0, 0);
  return { group, height: 3.1, eyeHeight: 2.75, animate };
}
