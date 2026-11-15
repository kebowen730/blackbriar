// Skinwalker — ~2 m human shape that is wrong: coyote-pelt hood, backwards knees/elbows, too-long neck.
import * as THREE from 'three';
import {
  seed, rr, tw, canvasTex, fillBase, blotches, strokes, stdMat, eyeMat, mk, limbGeo, coneGeo,
  Merger, shaggy, eyeMesh, Rig,
} from './_helpersA.js';

export function build() {
  seed(77701);
  const group = new THREE.Group();
  const rig = new Rig();

  // ---------- materials (3) ----------
  const skinTex = canvasTex(128, (g, s) => {
    fillBase(g, s, '#8d8b86');
    blotches(g, s, ['#6f6f6c', '#a6a49c', '#6b6063', '#7c8088'], 120, 4, 18, 0.3);
    strokes(g, s, ['#57606a', '#5a4b50'], 60, 26, 0.9, 0.32, Math.PI / 2, 0.7);
  }, 1.5, 1.5);
  const furTex = canvasTex(128, (g, s) => {
    fillBase(g, s, '#7b6b56');
    blotches(g, s, ['#5b4d3d', '#9b8b70', '#3b3128', '#8a7a62'], 110, 4, 16, 0.35);
    strokes(g, s, ['#2b231c', '#b8a98d', '#4d4033'], 220, 20, 1.2, 0.4, Math.PI / 2, 0.25);
  }, 1.5, 1.5);
  const skin = new THREE.MeshStandardMaterial({ map: skinTex, vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });
  const fur = new THREE.MeshStandardMaterial({ map: furTex, vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  const eyeM = eyeMat(0xffb12e);

  const sph = new THREE.SphereGeometry(1, 8, 6);
  const NAIL = 0x1c1513, TOOTH = 0xd9d3c0;

  // ---------- body ----------
  const hips = rig.add(group, 0, 0.95, 0);
  {
    const m = new Merger(0.12);
    m.add(sph, 0, 0, 0, 0, 0, 0, 0.15, 0.1, 0.1);
    m.add(sph, -0.14, 0.04, 0, 0, 0, 0, 0.05); m.add(sph, 0.14, 0.04, 0, 0, 0, 0, 0.05);
    mk(hips, m.build(), skin);
  }
  const TH = 0.43, SH = 0.43;
  const hipJ = [], kneeJ = [], ankJ = [];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const hj = rig.add(hips, s * 0.1, -0.04, 0);
    mk(hj, limbGeo(TH, 0.065, 0.045, { prof: [1.2, 1.1, 0.85, 0.85, 1.3], jag: 0.05 }), skin);
    const kj = rig.add(hj, 0, -TH, 0);
    mk(kj, limbGeo(SH, 0.045, 0.028, { prof: [1.4, 0.9, 0.8, 0.85, 1.2], jag: 0.05 }), skin);
    const aj = rig.add(kj, 0, -SH, 0);
    const fm = new Merger(0.12);
    fm.add(sph, 0, 0, 0.0, 0, 0, 0, 0.03, 0.025, 0.04);
    fm.add(sph, 0, -0.005, 0.1, 0, 0, 0, 0.026, 0.016, 0.1);
    const toe = coneGeo(0.01, 0.12, 4); toe.rotateX(Math.PI / 2);
    for (let k = -1; k <= 1; k++) fm.add(toe, k * 0.022, -0.01, 0.17, 0.1, k * 0.1, 0, 1, 1, 1, 0x6f6a66);
    mk(aj, fm.build(), skin);
    hipJ.push(hj); kneeJ.push(kj); ankJ.push(aj);
  }

  const spine = rig.add(hips, 0, 0.06, 0);
  mk(spine, limbGeo(0.34, 0.11, 0.09, { up: true, rs: 7, prof: [1.1, 0.9, 0.8, 0.88, 1.05] }), skin);
  const chest = rig.add(spine, 0, 0.34, 0);
  {
    const m = new Merger(0.12);
    m.add(sph, 0, 0.14, 0, 0, 0, 0, 0.15, 0.2, 0.1);
    m.add(sph, -0.2, 0.3, 0, 0, 0, 0, 0.055); m.add(sph, 0.2, 0.3, 0, 0, 0, 0, 0.055);
    // faint rib ridges
    const rib = new THREE.TorusGeometry(1, 0.05, 3, 9, Math.PI); rib.rotateX(Math.PI / 2); rib.rotateY(-Math.PI / 2 + 0.2 - Math.PI / 2);
    for (let i = 0; i < 4; i++) m.add(rib, 0, 0.04 + i * 0.06, 0.02, 0, 0, 0, 0.13, 0.4, 0.09, 0x777573);
    mk(chest, m.build(), skin);
    // pelt: mantle over shoulders/back + hanging rear flaps
    const pm = new Merger(0.2);
    shaggy(pm, { cy: 0.2, cz: -0.04, rx: 0.2, ry: 0.2, rz: 0.12, n: 40, len: 0.32, w: 0.055, dy: -1, dz: -0.15, out: 0.55, color: [0x7b6b56, 0x5b4d3d, 0x9b8b70, 0x3b3128], yMin: -0.2 });
    shaggy(pm, { cy: 0.31, cz: -0.02, rx: 0.2, ry: 0.07, rz: 0.12, n: 14, len: 0.22, w: 0.05, dy: -0.5, dz: -0.4, out: 0.9, color: [0x8a7a62, 0x5b4d3d] });
    pm.add(sph, 0, 0.3, -0.05, 0, 0, 0, 0.22, 0.07, 0.13, 0x6a5b49);
    mk(chest, pm.build(), fur);
  }
  // dangling forelegs of the pelt on the chest + tail
  const flap = [];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const j = rig.add(chest, s * 0.1, 0.33, 0.1);
    const pm = new Merger(0.2);
    pm.add(limbGeo(0.5, 0.045, 0.022, { rs: 5, hs: 3 }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0x7b6b56);
    pm.add(sph, 0, -0.5, 0.01, 0, 0, 0, 0.03, 0.045, 0.035, 0x3b3128);
    shaggy(pm, { cy: -0.2, rx: 0.045, ry: 0.22, rz: 0.04, n: 8, len: 0.14, w: 0.03, dy: -1, dz: 0, color: [0x9b8b70, 0x5b4d3d] });
    mk(j, pm.build(), fur);
    flap.push(j);
  }
  const tail = rig.add(hips, 0, -0.02, -0.12);
  {
    const pm = new Merger(0.2);
    pm.add(limbGeo(0.5, 0.05, 0.02, { rs: 5, hs: 3, prof: [1, 1.5, 1.6, 1.2, 0.8] }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0x7b6b56);
    shaggy(pm, { cy: -0.25, rx: 0.07, ry: 0.25, rz: 0.07, n: 12, len: 0.16, w: 0.04, dy: -1, dz: 0, color: [0x5b4d3d, 0x3b3128, 0x9b8b70] });
    mk(tail, pm.build(), fur);
  }

  // too-long neck (two joints)
  const neck1 = rig.add(chest, 0, 0.3, 0);
  mk(neck1, limbGeo(0.2, 0.05, 0.04, { up: true, rs: 6, prof: [1.2, 0.9, 0.85, 0.9, 1] }), skin);
  const neck2 = rig.add(neck1, 0, 0.2, 0);
  mk(neck2, limbGeo(0.2, 0.04, 0.037, { up: true, rs: 6, prof: [1, 0.9, 0.9, 0.95, 1.1] }), skin);
  const head = rig.add(neck2, 0, 0.2, 0);
  {
    // pale human face under the hood
    const m = new Merger(0.1);
    m.add(sph, 0, -0.04, 0.035, 0, 0, 0, 0.075, 0.11, 0.085);
    m.add(sph, 0, -0.14, 0.06, 0, 0, 0, 0.04, 0.07, 0.04);
    m.add(sph, 0, -0.035, 0.12, 0.3, 0, 0, 0.012, 0.04, 0.015, 0x8d8b86);  // nose ridge
    for (const s of [-1, 1]) {
      m.add(sph, s * 0.036, 0.0, 0.092, 0, 0, 0, 0.025, 0.03, 0.025, 0x090706);   // sunken sockets
      m.add(sph, s * 0.055, -0.07, 0.08, 0, 0, 0, 0.025, 0.03, 0.03, 0x6f6f72);   // hollow cheeks
    }
    m.add(new THREE.BoxGeometry(1, 1, 1), 0, -0.098, 0.112, 0, 0, 0, 0.12, 0.007, 0.01, 0x140d0d); // wide grin line
    const tooth = coneGeo(0.006, 0.026, 4); tooth.rotateX(Math.PI);
    for (let i = -4; i <= 4; i++) m.add(tooth, i * 0.012, -0.1, 0.108 - Math.abs(i) * 0.002, 0, 0, 0, 1, 1, 1, TOOTH);
    mk(head, m.build(), skin);
    // coyote hood sitting on top of the head
    const h = new Merger(0.18);
    h.add(sph, 0, 0.07, -0.02, 0, 0, 0, 0.125, 0.1, 0.16, 0x7b6b56);
    const sn = new THREE.CylinderGeometry(0.022, 0.06, 0.32, 6, 2); sn.rotateX(Math.PI / 2);
    h.add(sn, 0, 0.1, 0.2, -0.12, 0, 0, 1, 1, 1, 0x8a7a62);
    h.add(sph, 0, 0.115, 0.37, 0, 0, 0, 0.025, 0.02, 0.025, 0x0a0706);
    for (const s of [-1, 1]) {
      h.addDir(coneGeo(0.05, 0.2, 4), s * 0.07, 0.15, -0.06, s * 0.25, 1, -0.2, 1, 1, 0.6, 0x5b4d3d);
      h.add(sph, s * 0.06, 0.09, 0.1, 0, 0, 0, 0.03, 0.03, 0.03, 0x050403);   // empty animal eyeholes
    }
    shaggy(h, { cy: 0.05, cz: -0.06, rx: 0.13, ry: 0.1, rz: 0.15, n: 26, len: 0.22, w: 0.045, dy: -1, dz: -0.35, color: [0x7b6b56, 0x5b4d3d, 0x9b8b70], out: 0.6, yMin: -0.3 });
    mk(head, h.build(), fur);
  }
  const jaw = rig.add(head, 0, -0.1, 0.03);
  {
    const m = new Merger(0.1);
    m.add(sph, 0, -0.03, 0.05, 0, 0, 0, 0.04, 0.03, 0.07);
    const tooth = coneGeo(0.006, 0.028, 4);
    for (let i = -3; i <= 3; i++) m.add(tooth, i * 0.011, -0.002, 0.095 - Math.abs(i) * 0.004, 0, 0, 0, 1, 1, 1, TOOTH);
    mk(jaw, m.build(), skin);
  }
  for (const s of [-1, 1]) eyeMesh(head, eyeM, 0.0105, s * 0.037, 0.0, 0.117);

  // arms: long, elbows backwards
  const shJ = [], elJ = [], wrJ = [], fiJ = [];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const sh = rig.add(chest, s * 0.21, 0.3, 0);
    mk(sh, limbGeo(0.52, 0.045, 0.032, { prof: [1.3, 0.95, 0.85, 0.85, 1.25], jag: 0.04 }), skin);
    const el = rig.add(sh, 0, -0.52, 0);
    mk(el, limbGeo(0.56, 0.032, 0.022, { prof: [1.35, 0.9, 0.8, 0.8, 1.2], jag: 0.04 }), skin);
    const wr = rig.add(el, 0, -0.56, 0);
    const pm = new Merger(0.12);
    pm.add(sph, 0, -0.04, 0, 0, 0, 0, 0.028, 0.05, 0.014);
    mk(wr, pm.build(), skin);
    const fi = rig.add(wr, 0, -0.08, 0);
    const fm = new Merger(0.15);
    const f1 = coneGeo(0.009, 0.13, 4); f1.rotateX(Math.PI);
    const f2 = coneGeo(0.0065, 0.1, 4);
    const nail = coneGeo(0.005, 0.045, 3);
    for (let k = 0; k < 4; k++) {
      const x = (k - 1.5) * 0.017, bend = 0.5 + rr(-0.15, 0.2);
      fm.add(f1, x, 0, 0, 0, 0, 0, 1, 1, 1, 0x7d7b78);
      fm.add(f2, x, -0.13, 0, Math.PI - bend, 0, 0, 1, 1, 1, 0x7d7b78);
      fm.add(nail, x, -0.13 - Math.cos(bend) * 0.1, Math.sin(bend) * 0.1, Math.PI - bend - 0.2, 0, 0, 1, 1, 1, NAIL);
    }
    fm.add(f2, s * 0.03, -0.01, 0.015, Math.PI - 0.8, 0, s * 0.5, 1, 1, 1, 0x7d7b78);
    mk(fi, fm.build(), skin);
    shJ.push(sh); elJ.push(el); wrJ.push(wr); fiJ.push(fi);
  }

  // ---------- animation ----------
  let ph = 0;
  const legExt = (hp, th, kn) => TH * Math.cos(hp + th) + SH * Math.cos(hp + th + kn);

  function animate(anim, t, dt, speed) {
    if (anim === 'frozen') return;
    dt = dt > 0.1 ? 0.1 : dt > 0 ? dt : 0;
    speed = speed || 0;
    let a = anim;
    if (a === 'crawl') a = 'run';
    else if (a !== 'walk' && a !== 'run' && a !== 'attack' && a !== 'special') a = 'idle';

    const br = Math.sin(t * 1.1);
    chest.g.scale.set(1 + 0.004 * br, 1 + 0.006 * br, 1 + 0.01 * br);
    let jawOpen = 0.0;
    let curl = 0.25;
    let rate = 9;
    const tf = tw(t, 1.9), tg = tw(t, 2.7, 3);

    if (a === 'walk') {
      // upright, stiff torso, reverse-jointed legs, head locked on target and cocked
      ph += dt * (2.7 + speed * 0.45);
      const s = Math.sin(ph), c = Math.cos(ph);
      hips.r(0.02, s * 0.1, s * 0.03);
      spine.r(0.03, -s * 0.1, 0);
      chest.r(0.03, -s * 0.06, 0);
      neck1.r(0.35, s * 0.04, 0.12);
      neck2.r(0.25, -s * 0.04, -0.05);
      head.r(-0.45, 0, 0.3 + tf * 0.25);
      hipJ[0].r(0.4 - s * 0.42, 0, 0.02); hipJ[1].r(0.4 + s * 0.42, 0, -0.02);
      kneeJ[0].r(-0.8 - Math.max(0, c) * 0.8, 0, 0); kneeJ[1].r(-0.8 - Math.max(0, -c) * 0.8, 0, 0);
      shJ[0].r(0.1 + s * 0.12, 0, -0.06); shJ[1].r(0.1 - s * 0.12, 0, 0.06);
      elJ[0].r(0.3, 0, 0); elJ[1].r(0.3, 0, 0);
      jawOpen = 0.04 + tg * 0.15;
    } else if (a === 'run') {
      // drops to all fours, spider-human scramble
      ph += dt * (4.8 + speed * 0.28);
      const s = Math.sin(ph), c = Math.cos(ph);
      hips.r(0.55 + 0.05 * Math.sin(ph * 2), s * 0.08, s * 0.05);
      spine.r(0.45, -s * 0.2, 0);
      chest.r(0.25, -s * 0.15, 0);
      neck1.r(-0.7, s * 0.1, 0);
      neck2.r(-0.45, -s * 0.1, 0);
      head.r(-0.2, 0, Math.sin(t * 3) * 0.1 + 0.2);
      hipJ[0].r(0.35 - s * 0.55, 0, 0.1); hipJ[1].r(0.35 + s * 0.55, 0, -0.1);
      kneeJ[0].r(-1.4 - Math.max(0, c) * 0.5, 0, 0); kneeJ[1].r(-1.4 - Math.max(0, -c) * 0.5, 0, 0);
      shJ[0].r(-0.85 + s * 0.55, 0, -0.2); shJ[1].r(-0.85 - s * 0.55, 0, 0.2);
      elJ[0].r(0.55 + Math.max(0, -s) * 0.7, 0, 0); elJ[1].r(0.55 + Math.max(0, s) * 0.7, 0, 0);
      jawOpen = 0.25 + 0.1 * Math.sin(ph * 2);
      curl = -0.1;
      rate = 12;
    } else if (a === 'attack') {
      const q = Math.sin(t * 16) * 0.03;
      hips.r(0.2, 0, 0);
      spine.r(0.5 + q, 0, 0);
      chest.r(0.3, 0, 0);
      neck1.r(-0.4, 0, 0.1);
      neck2.r(-0.1, 0, 0);
      head.r(-0.2, 0, 0.1);
      hipJ[0].r(0.0, 0, 0.1); hipJ[1].r(0.55, 0, -0.1);
      kneeJ[0].r(-0.9, 0, 0); kneeJ[1].r(-1.4, 0, 0);
      shJ[0].r(-1.7 + q, 0, -0.35); shJ[1].r(-1.65 - q, 0, 0.35);
      elJ[0].r(0.2, 0, 0); elJ[1].r(0.25, 0, 0);
      jawOpen = 1.0;
      curl = -0.3;
      rate = 14;
    } else if (a === 'special') {
      // head snaps sideways, jaw hangs wide
      const q = Math.sin(t * 22) * 0.02;
      hips.r(0.0, 0, 0);
      spine.r(-0.05, 0, 0);
      chest.r(-0.1, 0, 0);
      neck1.r(0.2, 1.1, 0.5);
      neck2.r(0.1, 0.6, 0.2);
      head.r(-0.3 + q, 0.3, 0.7);
      hipJ[0].r(0.4, 0, 0.12); hipJ[1].r(0.4, 0, -0.12);
      kneeJ[0].r(-0.8, 0, 0); kneeJ[1].r(-0.8, 0, 0);
      shJ[0].r(0.0, 0, -0.9); shJ[1].r(0.0, 0, 0.9);
      elJ[0].r(0.5, 0, 0); elJ[1].r(0.5, 0, 0);
      jawOpen = 1.1;
      curl = 0.9;
    } else {
      // idle: unnaturally still, head slowly turning
      const turn = Math.sin(t * 0.13) * 1.5 + Math.sin(t * 0.31) * 0.2;
      hips.r(0.0, 0, 0);
      spine.r(0.0, turn * 0.08, 0);
      chest.r(0.0, turn * 0.1, 0);
      neck1.r(0.28, turn * 0.35, 0.1);
      neck2.r(0.12, turn * 0.35, 0.05);
      head.r(-0.3, turn * 0.3, 0.32 + tg * 0.2);
      hipJ[0].r(0.4, 0, 0.03); hipJ[1].r(0.4, 0, -0.03);
      kneeJ[0].r(-0.8, 0, 0); kneeJ[1].r(-0.8, 0, 0);
      shJ[0].r(0.1, 0, -0.04); shJ[1].r(0.1, 0, 0.04);
      elJ[0].r(0.28, 0, 0); elJ[1].r(0.28, 0, 0);
      jawOpen = 0.02 + tf * 0.22;
      rate = 6;
    }
    jaw.r(jawOpen, 0, 0);
    for (let i = 0; i < 2; i++) {
      fiJ[i].r(curl + tw(t, 3.1, i * 2.3) * 0.8 + 0.08 * Math.sin(t * 1.7 + i * 2), 0, 0);
      wrJ[i].r(0.08 * Math.sin(t * 0.9 + i), 0, 0);
    }
    const sway = a === 'run' ? 0.7 : a === 'walk' ? 0.25 : 0.04;
    for (let i = 0; i < 2; i++) flap[i].r(0.05 + sway * Math.sin(ph + i * 1.5) + 0.04 * Math.sin(t * 1.3 + i), 0, 0.05 * Math.sin(t * 0.9 + i * 2));
    tail.r(0.4 + sway * 0.6 * Math.sin(ph * 2) + 0.05 * Math.sin(t * 1.1), 0.1 * Math.sin(t * 0.7), 0);

    rig.step(dt, rate);

    const hp = hips.g.rotation.x;
    const e0 = legExt(hp, hipJ[0].g.rotation.x, kneeJ[0].g.rotation.x);
    const e1 = legExt(hp, hipJ[1].g.rotation.x, kneeJ[1].g.rotation.x);
    hips.g.position.y = Math.max(e0, e1) + 0.09;
    for (let i = 0; i < 2; i++) {
      const cum = hp + hipJ[i].g.rotation.x + kneeJ[i].g.rotation.x;
      ankJ[i].g.rotation.x = -cum;
    }
  }

  animate('idle', 0, 0, 0);
  return { group, height: 2.05, eyeHeight: 1.9, animate };
}
