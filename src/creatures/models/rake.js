// Rake — hairless pale grey humanoid that scuttles on all fours; hollow black eyes, slit mouth, spine knobs.
import * as THREE from 'three';
import {
  seed, rr, tw, canvasTex, fillBase, blotches, strokes, eyeMat, mk, limbGeo, coneGeo,
  Merger, eyeMesh, Rig,
} from './_helpersA.js';

export function build() {
  seed(9090);
  const group = new THREE.Group();
  const rig = new Rig();

  // ---------- materials (2) ----------
  const skinTex = canvasTex(128, (g, s) => {
    fillBase(g, s, '#9d9c97');
    blotches(g, s, ['#7d7c79', '#b8b6af', '#6c6a6e', '#8f8a86'], 110, 4, 20, 0.3);
    strokes(g, s, ['#4b4a52', '#5e5458'], 70, 28, 0.9, 0.3, Math.PI / 2, 0.8);
  }, 1.5, 1.5);
  const skin = new THREE.MeshStandardMaterial({ map: skinTex, vertexColors: true, roughness: 0.8, metalness: 0, flatShading: true });
  const glintM = eyeMat(0xdce8f2);

  const sph = new THREE.SphereGeometry(1, 8, 6);
  const BLACK = 0x040404, CLAW = 0x1a1716, KNOB = 0xc2c0ba;
  const A1 = 0.5, A2 = 0.62, L1 = 0.5, L2 = 0.7; // arm upper/fore, leg thigh/shin

  // ---------- body (segments grow along +Z) ----------
  const pelvis = rig.add(group, 0, 0.56, -0.5);
  {
    const m = new Merger(0.12);
    m.add(sph, 0, 0, 0, 0, 0, 0, 0.12, 0.09, 0.16);
    m.add(sph, 0, 0.07, -0.1, 0, 0, 0, 0.03, 0.03, 0.03, KNOB);
    mk(pelvis, m.build(), skin);
  }
  const rearFrame = rig.add(pelvis, 0, 0, 0);
  const spine1 = rig.add(pelvis, 0, 0, 0.1);
  {
    const m = new Merger(0.12);
    m.add(limbGeo(0.5, 0.09, 0.105, { z: true, rs: 6, hs: 4, flat: 0.85, prof: [1, 0.9, 0.85, 0.95, 1.05] }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0xffffff);
    for (let i = 0; i < 6; i++) m.add(sph, 0, 0.088, 0.04 + i * 0.085, 0, 0, 0, 0.02 + (i % 2) * 0.006, 0.03, 0.02, KNOB);
    mk(spine1, m.build(), skin);
  }
  const spine2 = rig.add(spine1, 0, 0, 0.5);
  {
    const m = new Merger(0.12);
    m.add(limbGeo(0.45, 0.105, 0.085, { z: true, rs: 7, hs: 4, flat: 0.9, prof: [1, 1.1, 1.1, 1, 0.9] }), 0, 0, 0, 0, 0, 0, 1, 1, 1, 0xffffff);
    for (let i = 0; i < 5; i++) m.add(sph, 0, 0.1, 0.04 + i * 0.085, 0, 0, 0, 0.022, 0.032, 0.022, KNOB);
    const ring = new THREE.TorusGeometry(1, 0.06, 3, 8);
    for (let i = 0; i < 5; i++) m.add(ring, 0, 0, 0.07 + i * 0.065, 0, 0, 0, 0.115 - i * 0.004, 0.1, 0.115, 0x8a8984);
    for (const s of [-1, 1]) m.add(sph, s * 0.11, 0.07, 0.15, 0, 0, 0.3 * s, 0.03, 0.07, 0.06, 0xb0aea8);  // shoulder blades
    mk(spine2, m.build(), skin);
  }
  const frontFrame = rig.add(spine2, 0, 0, 0.3);

  // neck + head
  const neck = rig.add(spine2, 0, 0.01, 0.42);
  mk(neck, limbGeo(0.24, 0.05, 0.04, { z: true, rs: 6, prof: [1.2, 0.9, 0.85, 0.9, 1] }), skin);
  const head = rig.add(neck, 0, 0, 0.24);
  {
    const m = new Merger(0.1);
    m.add(sph, 0, 0, 0.03, 0, 0, 0, 0.1, 0.115, 0.13);                                 // big bald skull
    m.add(sph, 0, -0.07, 0.07, 0, 0, 0, 0.065, 0.06, 0.07, 0xa8a7a2);                  // narrow lower face
    for (const s of [-1, 1]) {
      m.add(sph, s * 0.056, 0.016, 0.095, 0, 0, 0, 0.056, 0.062, 0.05, BLACK);         // huge hollow eyes
      m.add(sph, s * 0.1, -0.01, 0.0, 0, 0, 0, 0.012, 0.03, 0.02, 0x7a7977);           // ear nub
    }
    m.add(sph, 0, -0.03, 0.135, 0, 0, 0, 0.01, 0.02, 0.01, 0x6a6866);                  // nose bump
    m.add(sph, 0, -0.072, 0.095, 0, 0, 0, 0.075, 0.03, 0.045, 0x120707);               // mouth cavity
    m.add(new THREE.BoxGeometry(1, 1, 1), 0, -0.052, 0.128, 0, 0, 0, 0.17, 0.006, 0.01, 0x0a0505); // wide slit
    mk(head, m.build(), skin);
  }
  const jaw = rig.add(head, 0, -0.075, 0.035);
  {
    const m = new Merger(0.1);
    m.add(sph, 0, -0.012, 0.045, 0, 0, 0, 0.055, 0.022, 0.06, 0xa8a7a2);
    m.add(sph, 0, -0.03, 0.095, 0, 0, 0, 0.02, 0.02, 0.025, 0xa8a7a2);
    const tooth = coneGeo(0.005, 0.03, 3);
    for (let i = -4; i <= 4; i++) m.add(tooth, i * 0.012, 0.0, 0.085 - Math.abs(i) * 0.005, 0, 0, 0, 1, 1, 1, 0xcfcbc0);
    mk(jaw, m.build(), skin);
  }
  for (const s of [-1, 1]) eyeMesh(head, glintM, 0.0065, s * 0.07, 0.03, 0.14);

  // limbs live in world-aligned frames (rear/front) so rest = hanging straight down
  const armS = [], elbS = [], wriS = [], fingS = [];
  const legS = [], kneS = [], ankS = [];
  function claws(m, n, spread, len) {
    const f = coneGeo(0.007, len, 4);
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * spread;
      m.add(f, x, 0, 0, Math.PI - 0.25 - (k % 2) * 0.1, 0, 0, 1, 1, 1, CLAW);
    }
  }
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    // arm
    const sh = rig.add(frontFrame, s * 0.14, 0, 0);
    mk(sh, limbGeo(A1, 0.038, 0.026, { rs: 5, prof: [1.4, 0.9, 0.75, 0.8, 1.3] }), skin);
    const el = rig.add(sh, 0, -A1, 0);
    mk(el, limbGeo(A2, 0.026, 0.016, { rs: 5, prof: [1.4, 0.85, 0.75, 0.8, 1] }), skin);
    const wr = rig.add(el, 0, -A2, 0);
    {
      const m = new Merger(0.12);
      m.add(sph, 0, -0.02, 0, 0, 0, 0, 0.022, 0.035, 0.012, 0x8d8b86);
      mk(wr, m.build(), skin);
    }
    const fi = rig.add(wr, 0, -0.05, 0);
    {
      const m = new Merger(0.12);
      const f1 = coneGeo(0.008, 0.13, 4); f1.rotateX(Math.PI);
      for (let k = 0; k < 4; k++) {
        const x = (k - 1.5) * 0.02, bend = 0.45 + rr(-0.1, 0.2), len2 = 0.07;
        m.add(f1, x, 0, 0, 0, 0, 0, 1, 1, 1, 0x8d8b86);
        const c = coneGeo(0.0055, len2, 4);
        m.add(c, x, -0.13, 0, Math.PI - bend, 0, 0, 1, 1, 1, CLAW);
      }
      m.add(coneGeo(0.006, 0.12, 4), s * 0.03, -0.01, 0.01, Math.PI - 0.7, 0, s * 0.6, 1, 1, 1, CLAW);
      mk(fi, m.build(), skin);
    }
    armS.push(sh); elbS.push(el); wriS.push(wr); fingS.push(fi);
    // leg
    const hp = rig.add(rearFrame, s * 0.12, 0, 0);
    mk(hp, limbGeo(L1, 0.05, 0.03, { rs: 5, prof: [1.4, 1, 0.8, 0.85, 1.3] }), skin);
    const kn = rig.add(hp, 0, -L1, 0);
    mk(kn, limbGeo(L2, 0.03, 0.017, { rs: 5, prof: [1.4, 0.9, 0.75, 0.8, 1] }), skin);
    const an = rig.add(kn, 0, -L2, 0);
    {
      const m = new Merger(0.12);
      m.add(sph, 0, -0.01, 0.02, 0, 0, 0, 0.024, 0.02, 0.05, 0x8d8b86);
      for (let k = -1; k <= 1; k++) m.add(coneGeo(0.007, 0.12, 4), k * 0.02, -0.005, 0.06, Math.PI / 2 + 0.5, k * 0.12, 0, 1, 1, 1, CLAW);
      mk(an, m.build(), skin);
    }
    legS.push(hp); kneS.push(kn); ankS.push(an);
  }

  // ---------- animation ----------
  let ph = 0;
  const cx = Math.cos;
  // pose one limb pair member: th = thigh/upper spread angle from straight-down (outward), sw = fore/aft swing,
  // sk = lower segment world spread angle, kx = lower-segment fore/aft flex
  function limb(up, lo, s, th, sw, sk, kx) {
    up.r(sw, 0, s * th);
    lo.r(kx, 0, s * (sk - th));
  }

  function animate(anim, t, dt, speed) {
    if (anim === 'frozen') return;
    dt = dt > 0.1 ? 0.1 : dt > 0 ? dt : 0;
    speed = speed || 0;
    let a = anim;
    if (a === 'walk' || a === 'run') a = 'crawl';
    else if (a !== 'crawl' && a !== 'attack' && a !== 'special') a = 'idle';

    const br = Math.sin(t * 2.2);
    spine2.g.scale.set(1 + 0.01 * br, 1 + 0.02 * br, 1);
    let jawOpen = 0.04;
    let curl = 0.3;
    let rate = 10;
    const tr = a === 'idle' ? 0.014 : 0.004;
    const t1 = Math.sin(t * 53) * tr, t2 = Math.sin(t * 61 + 1.3) * tr, t3 = Math.sin(t * 47 + 2.1) * tr;

    if (a === 'crawl') {
      ph += dt * (13 + speed * 0.9);
      const f = ph;
      const s0 = Math.sin(f), s1 = Math.sin(f + Math.PI);
      const c0 = Math.max(0, Math.cos(f)), c1 = Math.max(0, Math.cos(f + Math.PI));
      pelvis.r(0.0, Math.sin(f) * 0.14, Math.sin(f + 1) * 0.04);
      spine1.r(0.03, -Math.sin(f) * 0.16, 0);
      spine2.r(-0.04, -Math.sin(f) * 0.08, 0);
      neck.r(-0.05, Math.sin(f) * 0.12, 0);
      head.r(0.0, 0, Math.sin(f * 0.5) * 0.06);
      // diagonal gait: front-left with rear-right
      limb(armS[0], elbS[0], -1, 1.55, -0.6 * s0, 0.2 + c0 * 0.6, 0.0);
      limb(armS[1], elbS[1], 1, 1.55, -0.6 * s1, 0.2 + c1 * 0.6, 0.0);
      limb(legS[0], kneS[0], -1, 1.6, -0.5 * s1, 0.25 + c1 * 0.6, 0.0);
      limb(legS[1], kneS[1], 1, 1.6, -0.5 * s0, 0.25 + c0 * 0.6, 0.0);
      jawOpen = 0.2 + 0.1 * Math.sin(f * 2);
      curl = 0.0;
      rate = 14;
    } else if (a === 'attack') {
      // pounce: front half lifts, arms reach, jaws wide
      const q = Math.sin(t * 18) * 0.04;
      pelvis.r(-0.2, 0, 0);
      spine1.r(-0.05, 0, 0);
      spine2.r(-0.1, 0, 0);
      neck.r(0.1, 0, 0);
      head.r(0.0, 0, 0);
      limb(armS[0], elbS[0], -1, 0.9 + q, -1.7, 0.4, -0.2);
      limb(armS[1], elbS[1], 1, 0.9 - q, -1.75, 0.4, -0.2);
      limb(legS[0], kneS[0], -1, 1.5, 0.7, 0.3, 0.0);
      limb(legS[1], kneS[1], 1, 1.5, 0.7, 0.3, 0.0);
      jawOpen = 1.15;
      curl = -0.5;
      rate = 16;
    } else if (a === 'special') {
      // rears up screeching, arms crossed in front of the face
      const q = Math.sin(t * 40) * 0.025;
      pelvis.r(-0.45, q, 0);
      spine1.r(-0.1, -q, 0);
      spine2.r(-0.05, q, 0);
      neck.r(0.35, 0, 0);
      head.r(0.0, 0, 0.1 * Math.sin(t * 9));
      limb(armS[0], elbS[0], -1, -0.3, -1.2, -0.3, -1.5);
      limb(armS[1], elbS[1], 1, -0.3, -1.2, -0.3, -1.5);
      limb(legS[0], kneS[0], -1, 1.5, 0.0, 0.3, 0.0);
      limb(legS[1], kneS[1], 1, 1.5, 0.0, 0.3, 0.0);
      jawOpen = 1.1 + 0.1 * Math.sin(t * 30);
      curl = 0.9;
      rate = 12;
    } else {
      // idle: crouched, head cocked sharply, shivering
      const cock = Math.tanh(Math.sin(t * 0.55) * 3);
      const snap = Math.tanh(Math.sin(t * 0.9 + 1) * 4);
      pelvis.r(0.05, t2 * 2, t1);
      spine1.r(0.08 + t1, t3, 0);
      spine2.r(0.12 + t2, t1, 0);
      neck.r(-0.35 + t3, cock * 0.3, cock * 0.5);
      head.r(-0.1, cock * 0.35 + snap * 0.15, cock * 0.7 + snap * 0.25 + t1 * 3);
      limb(armS[0], elbS[0], -1, 2.3, 0.0 + t1, 0.0, 0.0);
      limb(armS[1], elbS[1], 1, 2.3, 0.0 + t2, 0.0, 0.0);
      limb(legS[0], kneS[0], -1, 2.1, -0.05 + t3, 0.15, 0.0);
      limb(legS[1], kneS[1], 1, 2.1, 0.05 + t2, 0.15, 0.0);
      jawOpen = 0.03 + tw(t, 0.8) * 0.35;
    }
    jaw.r(jawOpen, 0, 0);
    for (let i = 0; i < 2; i++) {
      fingS[i].r(curl + 0.15 * Math.sin(t * 2.6 + i * 2) + tw(t, 3.3, i * 2) * 0.6, 0, 0);
    }

    rig.step(dt, rate);

    // compensate pitch so limb frames stay world-aligned
    const pr = pelvis.g.rotation.x;
    rearFrame.g.rotation.x = -pr;
    frontFrame.g.rotation.x = -(pr + spine1.g.rotation.x + spine2.g.rotation.x);
    // feet / hands stay vertical
    for (let i = 0; i < 2; i++) {
      ankS[i].g.rotation.z = -(legS[i].g.rotation.z + kneS[i].g.rotation.z);
      ankS[i].g.rotation.x = -(legS[i].g.rotation.x + kneS[i].g.rotation.x) * 0.5;
      wriS[i].g.rotation.z = -(armS[i].g.rotation.z + elbS[i].g.rotation.z);
      wriS[i].g.rotation.x = -(armS[i].g.rotation.x + elbS[i].g.rotation.x) * 0.3;
    }
    // ride on the lower of the two rear legs
    let best = 0;
    for (let i = 0; i < 2; i++) {
      const th = legS[i].g.rotation, kn = kneS[i].g.rotation;
      const e = L1 * cx(th.z) * cx(th.x) + L2 * cx(th.z + kn.z) * cx(th.x + kn.x);
      if (e > best) best = e;
    }
    pelvis.g.position.y = best + 0.05;
    // arms: never sink below the ground (planted hands); lifted hands stay lifted
    if (a === 'crawl' || a === 'idle') {
      const s1 = spine1.g.rotation.x, s2 = spine2.g.rotation.x;
      const frontY = pelvis.g.position.y - (0.1 * Math.sin(pr) + 0.5 * Math.sin(pr + s1) + 0.3 * Math.sin(pr + s1 + s2));
      const need = frontY - 0.17;
      for (let i = 0; i < 2; i++) {
        const sd = i === 0 ? -1 : 1;
        const sr = armS[i].g.rotation, er = elbS[i].g.rotation;
        const cs = cx(sr.x), ce = cx(sr.x + er.x);
        let c = (need - A1 * cx(sr.z) * cs) / (A2 * (ce > 0.2 ? ce : 0.2));
        c = c > 1 ? 1 : c < -1 ? -1 : c;
        const skP = Math.acos(c);
        const skC = sd * (sr.z + er.z);
        if (skP > skC) er.z = sd * skP - sr.z;
      }
    }
  }

  animate('idle', 0, 0, 0);
  return { group, height: 0.95, eyeHeight: 0.62, animate };
}
