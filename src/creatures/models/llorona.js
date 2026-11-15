// La Llorona: drowned weeping woman in a soaked white dress, hands over her face.
import * as THREE from 'three';
import { canvasTex, rng, makePose, applySpec, stepPose, taperGeo, ellipsoid, mk, makeStripSet } from './_helpersC.js';

// shA/shB/el: shoulder pitch, shoulder inward(-)/outward(+) swing, elbow. Defaults = hands pressed to face.
const DEF = { shA: -1.0, shB: -0.95, el: -2.1, reveal: 0, hunch: 0.5, sob: 1, sway: 0.04, jit: 0, stream: 0, glide: 0, lift: 0 };
const SPECS = {
  idle: DEF,
  walk: { shA: -1.0, shB: -0.95, el: -2.1, reveal: 0, hunch: 0.38, sob: 0.8, sway: 0.05, jit: 0, stream: 0.12, glide: 1, lift: 0 },
  attack: { shA: -1.3, shB: 0.6, el: -0.2, reveal: 1, hunch: 0.1, sob: 0, sway: 0, jit: 1, stream: 0.55, glide: 1, lift: 0.03 },
  special: { shA: -0.12, shB: 0.1, el: -0.15, reveal: 1, hunch: 0.04, sob: 0, sway: 0.01, jit: 0.15, stream: 0, glide: 0, lift: 0 },
};
const ALIAS = { run: 'attack', fly: 'walk', crawl: 'idle' };

export function build() {
  const R = rng(909);
  const dressTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#dcdcd4';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 50; i++) {
      g.fillStyle = `rgba(${R() < 0.5 ? '160,165,160' : '245,245,240'},${0.1 + R() * 0.2})`;
      g.fillRect(R() * w, 0, 1 + R() * 3, h);
    }
    // water stains rising from the hem (canvas bottom = hem)
    for (let i = 0; i < 70; i++) {
      const x = R() * w, sw = 2 + R() * 10, sh = h * (0.08 + R() * R() * 0.5);
      const gr = g.createLinearGradient(0, h, 0, h - sh);
      gr.addColorStop(0, 'rgba(25,32,30,0.75)');
      gr.addColorStop(0.6, 'rgba(60,70,65,0.35)');
      gr.addColorStop(1, 'rgba(80,90,85,0)');
      g.fillStyle = gr;
      g.fillRect(x, h - sh, sw, sh);
    }
    g.fillStyle = 'rgba(30,38,35,0.55)';
    g.fillRect(0, h - h * 0.07, w, h * 0.07);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(50,60,56,0.35)';
      g.fillRect(R() * w, h * (0.35 + R() * 0.45), 1.5, 8 + R() * 20);
    }
  });
  const dress = new THREE.MeshStandardMaterial({ color: 0xf0f0ea, map: dressTex, roughness: 0.82, side: THREE.DoubleSide });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb4b2ac, roughness: 0.75 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.3, side: THREE.DoubleSide });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const pinM = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // skirt (hem -> hip), uv.v remapped to the lower 72% of the texture
  const skirtProf = [[0.34, 0.02], [0.33, 0.15], [0.28, 0.4], [0.2, 0.65], [0.155, 0.85], [0.15, 0.95]].map(p => new THREE.Vector2(p[0], p[1]));
  const skG = new THREE.LatheGeometry(skirtProf, 24);
  {
    const pa = skG.attributes.position, ua = skG.attributes.uv;
    for (let i = 0; i < pa.count; i++) {
      if (pa.getY(i) < 0.05) {
        const k = 1 + (R() - 0.5) * 0.14;
        pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) + R() * 0.035, pa.getZ(i) * k);
      }
      ua.setY(i, ua.getY(i) * 0.72);
    }
    skG.computeVertexNormals();
  }
  const skirt = mk(skG, dress);
  skirt.scale.z = 0.85;
  body.add(skirt);

  // torso
  const torso = new THREE.Group();
  torso.position.y = 0.95;
  body.add(torso);
  const toProf = [[0.15, 0], [0.125, 0.12], [0.115, 0.25], [0.13, 0.38], [0.145, 0.48], [0.14, 0.54], [0.06, 0.6], [0.04, 0.62]].map(p => new THREE.Vector2(p[0], p[1]));
  const toG = new THREE.LatheGeometry(toProf, 18);
  {
    const ua = toG.attributes.uv;
    for (let i = 0; i < ua.count; i++) ua.setY(i, 0.72 + ua.getY(i) * 0.28);
  }
  const torsoMesh = mk(toG, dress);
  torsoMesh.scale.set(1.15, 1, 0.8);
  torso.add(torsoMesh);

  // head
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.6, 0.02);
  torso.add(headPivot);
  const neck = mk(taperGeo(0.035, 0.045, 0.1, 8), skin);
  neck.position.y = 0.04;
  headPivot.add(neck);
  const head = ellipsoid(skin, 0.09, 0.115, 0.095, true, 14, 10);
  head.position.y = 0.1;
  headPivot.add(head);
  const sockets = [], pins = [];
  for (const s of [-1, 1]) {
    const sk = ellipsoid(black, 0.02, 0.027, 0.014, false, 8, 6);
    sk.position.set(s * 0.035, 0.115, 0.082);
    headPivot.add(sk);
    sockets.push(sk);
    const pn = ellipsoid(pinM, 0.004, 0.004, 0.004, false, 5, 4);
    pn.position.set(s * 0.035, 0.115, 0.094);
    headPivot.add(pn);
    pins.push(pn);
  }
  const mouth = ellipsoid(black, 0.028, 0.004, 0.01, false, 10, 8);
  mouth.position.set(0, 0.04, 0.088);
  headPivot.add(mouth);

  // hair: back mass + two parting curtains
  const hb = [];
  for (let i = 0; i < 20; i++) {
    const a = Math.PI * (0.45 + (i / 19) * 1.1) * (i % 2 ? 1 : -1) + (i % 2 ? 0 : 0);
    const ox = Math.sin(a), oz = Math.cos(a);
    hb.push({ x: ox * 0.1, y: 0.2, z: oz * 0.1, ox, oz, hw: 0.035 + R() * 0.02, len: 0.55 + R() * 0.3, flare: 0.07 + R() * 0.07, seed: R() * 6.28 });
  }
  const hairBack = makeStripSet(hb, 9);
  const hairBackMesh = mk(hairBack.geometry, hairM);
  hairBackMesh.frustumCulled = false;
  headPivot.add(hairBackMesh);
  const curtains = [];
  for (const side of [1, -1]) {
    const piv = new THREE.Group();
    piv.position.set(0, 0.2, 0);
    headPivot.add(piv);
    const cs = [];
    for (let i = 0; i < 7; i++) {
      const a = side * (0.15 + i * 0.2);
      const ox = Math.sin(a), oz = Math.cos(a);
      cs.push({ x: ox * 0.1, y: 0, z: oz * 0.1, ox, oz, hw: 0.026 + R() * 0.01, len: 0.28 + R() * 0.22, flare: 0.03, seed: R() * 6.28 });
    }
    const set = makeStripSet(cs, 7);
    const m = mk(set.geometry, hairM);
    m.frustumCulled = false;
    piv.add(m);
    curtains.push({ piv, set, side });
  }

  // arms
  const arms = [];
  for (const side of [1, -1]) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.17, 0.52, 0);
    torso.add(sh);
    sh.add(mk(taperGeo(0.034, 0.028, 0.28, 8), skin));
    const el = new THREE.Group();
    el.position.y = -0.28;
    sh.add(el);
    el.add(mk(taperGeo(0.028, 0.02, 0.25, 8), skin));
    const hand = new THREE.Group();
    hand.position.y = -0.25;
    el.add(hand);
    const palm = ellipsoid(skin, 0.032, 0.045, 0.012, true, 8, 6);
    palm.position.y = -0.035;
    hand.add(palm);
    const fingers = [];
    for (let f = 0; f < 3; f++) {
      const fp = new THREE.Group();
      fp.position.set((f - 1) * 0.02, -0.07, 0);
      hand.add(fp);
      fp.add(mk(taperGeo(0.007, 0.004, 0.07, 5), skin));
      fingers.push(fp);
    }
    arms.push({ sh, el, hand, fingers, side });
  }

  const pose = makePose(DEF);
  const P = pose.cur;
  const st = { hx: 0.3, hy: 0 };

  function animate(anim, t, dt, speed) {
    if (anim === 'frozen') return;
    dt = Math.min(dt || 0.016, 0.1);
    const key = SPECS[anim] ? anim : (ALIAS[anim] || 'idle');
    applySpec(pose, SPECS[key]);
    stepPose(pose, dt, key === 'special' ? 1.6 : 3.5);

    const sobPhase = Math.sin(t * 2.6) * 0.5 + 0.5;
    const h = sobPhase * sobPhase * sobPhase * P.sob;
    const jit = P.jit;

    body.position.y = P.lift + Math.sin(t * 1.3) * 0.01 * P.glide;
    body.position.x = Math.sin(t * 47) * 0.014 * jit;
    body.rotation.z = Math.sin(t * 0.8) * P.sway + Math.sin(t * 1.8) * 0.03 * P.glide + Math.sin(t * 39) * 0.03 * jit;
    body.rotation.x = Math.sin(t * 53) * 0.02 * jit - P.stream * 0.1;
    skirt.rotation.z = Math.sin(t * 0.9 + 1) * 0.02;
    skirt.scale.x = 1 + Math.sin(t * 1.4) * 0.015 + P.glide * Math.sin(t * 2.0) * 0.02;

    torso.rotation.x = P.hunch + h * 0.07;
    torso.scale.y = 1 + h * 0.015 + Math.sin(t * 1.5) * 0.006;
    const shoulderLift = h * 0.02;

    // head: snaps up in 'special', otherwise nods with the sobs
    const hxT = key === 'special' ? -0.28 - P.hunch : (0.32 - P.hunch * 0.5) + h * 0.12 - P.reveal * 0.15;
    const kk = key === 'special' ? 16 : 4;
    st.hx += (hxT - st.hx) * (1 - Math.exp(-kk * dt));
    const hyT = key === 'special' ? 0 : Math.sin(t * 0.5) * 0.12 * (1 - P.reveal * 0.6);
    st.hy += (hyT - st.hy) * (1 - Math.exp(-kk * dt));
    headPivot.rotation.x = st.hx;
    headPivot.rotation.y = st.hy;
    headPivot.rotation.z = Math.sin(t * 0.7) * 0.05 + Math.sin(t * 43) * 0.04 * jit;

    // face reveal
    const rv = P.reveal;
    for (let i = 0; i < 2; i++) {
      sockets[i].scale.set(0.014 + 0.012 * rv, 0.006 + 0.024 * rv, 0.014);
      const ps = 0.0001 + rv * (0.9 + Math.sin(t * 20 + i) * 0.15);
      pins[i].scale.setScalar(0.004 * ps * 1.2);
    }
    mouth.scale.set(0.02 + 0.014 * rv, 0.004 + 0.075 * rv * (0.85 + 0.15 * Math.sin(t * 31)), 0.01);
    mouth.position.y = 0.04 - 0.02 * rv;

    for (let c = 0; c < 2; c++) {
      const C = curtains[c];
      C.piv.rotation.z = C.side * (0.1 + rv * 0.75 + Math.sin(t * 1.1 + c) * 0.03);
      C.set.update(t, 0.02 + 0.015 * jit, 1.8, P.stream * 0.7, jit, 0);
    }
    hairBack.update(t, 0.03 + 0.02 * jit, 1.4, P.stream + 0.05, jit, 0);

    for (let a = 0; a < 2; a++) {
      const A = arms[a];
      A.sh.position.y = 0.52 + shoulderLift;
      A.sh.rotation.x = P.shA + h * 0.04 + Math.sin(t * 1.2 + a) * 0.03 + Math.sin(t * 45 + a) * 0.06 * jit;
      A.sh.rotation.z = A.side * (P.shB + Math.sin(t * 0.9 + a) * 0.03);
      A.el.rotation.x = P.el + h * 0.05;
      A.hand.rotation.x = -0.1 * (1 - rv) + Math.sin(t * 2 + a) * 0.05;
      for (let f = 0; f < 3; f++) {
        A.fingers[f].rotation.x = -(0.25 + rv * 0.6) - Math.sin(t * 3 + f + a) * 0.08;
        A.fingers[f].rotation.z = (f - 1) * (0.1 + rv * 0.3);
      }
    }
  }

  animate('idle', 0, 0.016, 0);
  return { group, height: 1.76, eyeHeight: 1.64, animate };
}
