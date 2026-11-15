// Banshee: floating spectral woman, tattered gown strips, long hair, impossible scream.
import * as THREE from 'three';
import { canvasTex, rng, makePose, applySpec, stepPose, taperGeo, ellipsoid, mk, makeStripSet, smooth } from './_helpersC.js';

const DEF = { bob: 0.06, lean: 0.04, hp: 0.15, hr: 0.08, jaw: 0.05, armF: 0.12, armO: 0.14, elbow: 0.25, curl: 0.5, vib: 0, wave: 0.06, stream: 0, fwd: 0 };
const SPECS = {
  idle: DEF,
  walk: { bob: 0.08, lean: 0.12, hp: 0.2, hr: 0.1, jaw: 0.08, armF: 0.2, armO: 0.15, elbow: 0.3, curl: 0.5, vib: 0, wave: 0.09, stream: 0.25, fwd: 0 },
  run: { bob: 0.08, lean: 0.28, hp: 0.1, hr: 0.1, jaw: 0.3, armF: 0.5, armO: 0.3, elbow: 0.3, curl: 0.3, vib: 0.2, wave: 0.11, stream: 0.5, fwd: 0 },
  special: { bob: 0.04, lean: 0, hp: 0, hr: 0, jaw: 1, armF: 0.5, armO: 1.5, elbow: 0.4, curl: 0.15, vib: 1, wave: 0.14, stream: 0.1, fwd: 0 },
  attack: { bob: 0.05, lean: 0.38, hp: 0.12, hr: 0.05, jaw: 1, armF: 1.45, armO: 0.35, elbow: 0.12, curl: -0.1, vib: 0.35, wave: 0.12, stream: 0.55, fwd: 0.12 },
};
const ALIAS = { fly: 'walk', crawl: 'idle' };

export function build() {
  const R = rng(1313);
  const gownTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b4c6bb';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${R() < 0.5 ? '90,120,105' : '215,235,225'},${0.1 + R() * 0.2})`;
      g.fillRect(R() * w, 0, 1 + R() * 4, h);
    }
  }, 3, 1);
  const skin = new THREE.MeshStandardMaterial({ color: 0xa9bfb3, roughness: 0.8, emissive: 0x16261f, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
  const gown = new THREE.MeshStandardMaterial({ color: 0x9fb5a8, map: gownTex, roughness: 0.9, emissive: 0x1d2e26, emissiveIntensity: 0.6, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x2b3532, roughness: 0.7, emissive: 0x0a1210, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const black = new THREE.MeshBasicMaterial({ color: 0x020303 });
  const glintM = new THREE.MeshBasicMaterial({ color: 0xd6ffe6, toneMapped: false });

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // gown upper (lathe, hem -> shoulders)
  const prof = [[0.25, 0.86], [0.2, 1.0], [0.135, 1.15], [0.105, 1.3], [0.125, 1.42], [0.15, 1.5], [0.08, 1.56], [0.03, 1.58]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  const upper = mk(new THREE.LatheGeometry(prof, 20), gown, false);
  upper.scale.z = 0.85;
  body.add(upper);

  // ragged strips
  const specs = [];
  const NS = 22;
  for (let i = 0; i < NS; i++) {
    const a = (i / NS) * Math.PI * 2 + R() * 0.1;
    const ox = Math.cos(a), oz = Math.sin(a);
    const rr = 0.245;
    const len = 0.32 + R() * 0.28;
    specs.push({ x: ox * rr, y: 0.9, z: oz * rr * 0.85, ox, oz, hw: 0.08, len, flare: 0.04 + R() * 0.08, seed: R() * 6.28 });
  }
  const strips = makeStripSet(specs, 7);
  const stripMesh = mk(strips.geometry, gown, false);
  stripMesh.frustumCulled = false;
  body.add(stripMesh);

  // neck + head
  const neck = mk(taperGeo(0.03, 0.04, 0.12, 8), skin, false);
  neck.position.y = 1.66;
  body.add(neck);
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.64, 0);
  body.add(headPivot);
  const head = ellipsoid(skin, 0.085, 0.125, 0.095, false, 14, 10);
  head.position.y = 0.12;
  headPivot.add(head);
  for (const s of [-1, 1]) {
    const sock = ellipsoid(black, 0.024, 0.03, 0.02, false, 8, 6);
    sock.position.set(s * 0.034, 0.145, 0.078);
    headPivot.add(sock);
    const gl = ellipsoid(glintM, 0.006, 0.006, 0.006, false, 6, 4);
    gl.position.set(s * 0.034, 0.145, 0.094);
    headPivot.add(gl);
  }
  const cavity = ellipsoid(black, 0.03, 0.006, 0.02, false, 10, 8);
  cavity.position.set(0, 0.045, 0.082);
  headPivot.add(cavity);
  const jaw = new THREE.Group();
  jaw.position.set(0, 0.07, 0.0);
  headPivot.add(jaw);
  const jawMesh = ellipsoid(skin, 0.055, 0.05, 0.055, false, 12, 8);
  jawMesh.position.set(0, -0.03, 0.05);
  jaw.add(jawMesh);

  // hair (relative to headPivot; head centre at y=0.12)
  const hs = [];
  const NH = 24;
  for (let i = 0; i < NH; i++) {
    const a = (i / NH) * Math.PI * 2;
    const ox = Math.sin(a), oz = Math.cos(a); // a=0 -> front (+z)
    const front = Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI);
    const sideCurtain = front < 1.2;
    const len = sideCurtain ? 0.45 + R() * 0.25 : 0.6 + R() * 0.35;
    const rr = 0.115;
    hs.push({ x: ox * rr, y: 0.2, z: oz * rr * 0.95, ox, oz, hw: 0.03 + R() * 0.02, len, flare: 0.03 + R() * 0.05, seed: R() * 6.28 });
  }
  // bangs over the face
  for (const a of [-0.25, 0.1, 0.3]) {
    const ox = Math.sin(a), oz = Math.cos(a);
    hs.push({ x: ox * 0.12, y: 0.235, z: oz * 0.1, ox, oz, hw: 0.018, len: 0.2 + R() * 0.12, flare: 0.015, seed: R() * 6.28 });
  }
  const hair = makeStripSet(hs, 8);
  const hairMesh = mk(hair.geometry, hairM, false);
  hairMesh.frustumCulled = false;
  headPivot.add(hairMesh);

  // arms
  const arms = [];
  for (const side of [1, -1]) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.17, 1.5, 0);
    body.add(sh);
    sh.add(mk(taperGeo(0.03, 0.022, 0.3, 8), skin, false));
    const el = new THREE.Group();
    el.position.y = -0.3;
    sh.add(el);
    el.add(mk(taperGeo(0.022, 0.015, 0.3, 8), skin, false));
    const hand = new THREE.Group();
    hand.position.y = -0.3;
    el.add(hand);
    const palm = ellipsoid(skin, 0.026, 0.04, 0.01, false, 8, 6);
    palm.position.y = -0.03;
    hand.add(palm);
    const fingers = [];
    for (let f = 0; f < 4; f++) {
      const fp = new THREE.Group();
      fp.position.set((f - 1.5) * 0.015, -0.065, 0);
      hand.add(fp);
      fp.add(mk(taperGeo(0.006, 0.002, 0.15 - (f === 0 || f === 3 ? 0.03 : 0), 5), skin, false));
      fingers.push(fp);
    }
    arms.push({ sh, el, hand, fingers, side });
  }

  const pose = makePose(DEF);
  const P = pose.cur;

  function animate(anim, t, dt, speed) {
    if (anim === 'frozen') return;
    dt = Math.min(dt || 0.016, 0.1);
    const key = SPECS[anim] ? anim : (ALIAS[anim] || 'idle');
    applySpec(pose, SPECS[key]);
    if (key === 'special') {
      // scream: head thrown back, then forward with the jaw dropping wide
      const c = (t % 2.8) / 2.8;
      if (c < 0.3) { pose.tgt.hp = -0.75; pose.tgt.jaw = 0.25; pose.tgt.lean = -0.12; }
      else { pose.tgt.hp = 0.3; pose.tgt.jaw = 1; pose.tgt.lean = 0.12; }
    }
    stepPose(pose, dt, key === 'special' ? 7 : 3.5);

    const vib = P.vib;
    body.position.y = P.bob * Math.sin(t * 1.2) + Math.sin(t * 0.5) * 0.02;
    body.position.x = Math.sin(t * 58) * 0.012 * vib;
    body.position.z = P.fwd + Math.cos(t * 49) * 0.008 * vib;
    body.rotation.x = P.lean + Math.sin(t * 0.9) * 0.02;
    body.rotation.z = Math.sin(t * 0.6) * 0.03 + Math.sin(t * 41) * 0.02 * vib;

    headPivot.rotation.x = P.hp + Math.sin(t * 0.8) * 0.04;
    headPivot.rotation.z = P.hr + Math.sin(t * 0.55 + 1) * 0.05;
    headPivot.rotation.y = Math.sin(t * 0.4) * 0.12;

    const jw = P.jaw;
    jaw.rotation.x = jw * 0.8 + Math.sin(t * 3) * 0.02;
    jaw.position.y = 0.07 - jw * 0.05;
    jawMesh.scale.y = 0.05 * (1 + jw * 0.9);
    cavity.scale.y = 0.006 + 0.085 * jw;
    cavity.scale.x = 0.03 + 0.02 * jw;
    cavity.position.y = 0.05 - 0.045 * jw;

    for (let a = 0; a < 2; a++) {
      const A = arms[a];
      const s = A.side;
      A.sh.rotation.x = -P.armF + Math.sin(t * 1.1 + a) * 0.05 + Math.sin(t * 47 + a) * 0.04 * vib;
      A.sh.rotation.z = s * (P.armO + Math.sin(t * 0.9 + a * 2) * 0.05);
      A.el.rotation.x = -P.elbow - Math.sin(t * 1.4 + a) * 0.06;
      A.hand.rotation.x = Math.sin(t * 1.7 + a) * 0.15;
      for (let f = 0; f < 4; f++) {
        A.fingers[f].rotation.x = -(P.curl + Math.sin(t * 1.5 + f * 0.7 + a) * 0.25 + (f % 2) * 0.1);
        A.fingers[f].rotation.z = (f - 1.5) * 0.08 * (1 + (1 - P.curl));
      }
    }

    const w = P.wave;
    strips.update(t, w, 2.2, P.stream, vib, 0);
    hair.update(t, w * 0.8, 1.7, P.stream * 0.8 - P.hp * 0.2, vib, 0);
  }

  animate('idle', 0, 0.016, 0);
  return { group, height: 1.9, eyeHeight: 1.76, animate };
}
