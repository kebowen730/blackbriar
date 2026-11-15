// Flatwoods Monster: hovering pleated green body, red face, glowing eyes, spade-shaped cowl.
import * as THREE from 'three';
import { canvasTex, rng, makePose, applySpec, stepPose, taperGeo, ellipsoid, mk } from './_helpersC.js';

const DEF = { bob: 0.06, spin: 0.25, armF: 1.1, elbow: 0.45, claw: 0.5, eye: 1, eyePulse: 0.15, tilt: 0, shudder: 0, strobe: 0, glow: 0.22 };
const SPECS = {
  idle: DEF,
  walk: { bob: 0.07, spin: 0.4, armF: 1.15, elbow: 0.4, claw: 0.55, eye: 1, eyePulse: 0.2, tilt: 0.08, shudder: 0, strobe: 0, glow: 0.25 },
  attack: { bob: 0.04, spin: 1.2, armF: 1.5, elbow: 0.15, claw: 0.9, eye: 1.6, eyePulse: 0.3, tilt: 0.42, shudder: 0.2, strobe: 0, glow: 0.4 },
  special: { bob: 0.03, spin: 2.5, armF: 1.2, elbow: 0.5, claw: 0.7, eye: 1.2, eyePulse: 0, tilt: -0.05, shudder: 1, strobe: 1, glow: 0.45 },
};
const ALIAS = { run: 'walk', fly: 'walk', crawl: 'idle' };

export function build() {
  const R = rng(4242);
  const skirtTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#2e4a36';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = `rgba(${R() < 0.5 ? '10,25,15' : '90,130,100'},${0.12 + R() * 0.15})`;
      g.fillRect(0, y, w, 2 + R() * 3);
    }
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(0,0,0,${R() * 0.15})`;
      g.fillRect(R() * w, R() * h, 2, 2);
    }
  }, 1, 1);
  const skirtM = new THREE.MeshStandardMaterial({ color: 0x4a6a54, map: skirtTex, roughness: 0.45, metalness: 0.45, side: THREE.DoubleSide });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x0b100d, roughness: 0.6, metalness: 0.25 });
  const faceM = new THREE.MeshStandardMaterial({ color: 0x8a0f0f, roughness: 0.55, emissive: 0x2a0202 });
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xffa860, toneMapped: false });
  const glowM = new THREE.MeshBasicMaterial({ color: 0x9fbf4a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  const group = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.position.y = 0.8;
  group.add(tilt);
  const inner = new THREE.Group();
  inner.position.y = -0.8;
  tilt.add(inner);

  // pleated skirt body (lathe with radial pleats)
  const prof = [[0.8, 0.4], [0.76, 0.55], [0.64, 0.9], [0.46, 1.3], [0.29, 1.65], [0.2, 1.9], [0.17, 2.08]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  const sg = new THREE.LatheGeometry(prof, 56, 0, Math.PI * 2);
  {
    const pa = sg.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const th = Math.atan2(z, x);
      const k = 1 + 0.1 * Math.cos(th * 14) * Math.min(1, (2.0 - y) / 1.0 + 0.2);
      pa.setXYZ(i, x * k, y, z * k);
    }
    sg.computeVertexNormals();
  }
  const skirt = mk(sg, skirtM);
  inner.add(skirt);

  // neck + shoulders
  const neck = mk(taperGeo(0.07, 0.12, 0.3, 8), darkM);
  neck.position.y = 2.2;
  inner.add(neck);
  const shoulders = ellipsoid(darkM, 0.26, 0.09, 0.16);
  shoulders.position.y = 1.98;
  inner.add(shoulders);

  // spade cowl
  const sh = new THREE.Shape();
  sh.moveTo(0, 1.0);
  sh.bezierCurveTo(0.15, 0.8, 0.55, 0.62, 0.55, 0.3);
  sh.bezierCurveTo(0.55, 0.02, 0.2, -0.02, 0.07, 0.17);
  sh.lineTo(0.17, -0.2);
  sh.lineTo(-0.17, -0.2);
  sh.lineTo(-0.07, 0.17);
  sh.bezierCurveTo(-0.2, -0.02, -0.55, 0.02, -0.55, 0.3);
  sh.bezierCurveTo(-0.55, 0.62, -0.15, 0.8, 0, 1.0);
  const cg = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 14 });
  const cowl = mk(cg, darkM);
  cowl.scale.setScalar(1.1);
  cowl.position.set(0, 2.3 - 0.33 + 0.0, -0.17);
  inner.add(cowl);

  // head
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 2.3, 0.02);
  inner.add(headPivot);
  const head = ellipsoid(faceM, 0.22, 0.23, 0.2, true, 20, 14);
  headPivot.add(head);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = ellipsoid(eyeM, 0.062, 0.085, 0.03, false, 12, 8);
    e.position.set(s * 0.09, 0.03, 0.175);
    e.rotation.z = s * 0.25;
    headPivot.add(e);
    eyes.push(e);
  }

  // arms
  const arms = [];
  for (const side of [1, -1]) {
    const shp = new THREE.Group();
    shp.position.set(side * 0.24, 1.98, 0.02);
    inner.add(shp);
    shp.add(mk(taperGeo(0.032, 0.02, 0.5, 6), darkM));
    const el = new THREE.Group();
    el.position.y = -0.5;
    shp.add(el);
    el.add(mk(taperGeo(0.02, 0.014, 0.5, 6), darkM));
    const hand = new THREE.Group();
    hand.position.y = -0.5;
    el.add(hand);
    const claws = [];
    for (let c = 0; c < 3; c++) {
      const cp = new THREE.Group();
      cp.position.x = (c - 1) * 0.022;
      hand.add(cp);
      cp.add(mk(new THREE.ConeGeometry(0.011, 0.24, 5).rotateX(Math.PI).translate(0, -0.12, 0), darkM));
      claws.push(cp);
    }
    arms.push({ shp, el, hand, claws, side });
  }

  // sickly ring underneath (emissive, not a light)
  const disc = mk(new THREE.CircleGeometry(0.95, 32).rotateX(-Math.PI / 2), glowM, false);
  disc.position.y = 0.03;
  group.add(disc);
  const ring = mk(new THREE.TorusGeometry(0.7, 0.05, 6, 36).rotateX(Math.PI / 2), glowM, false);
  ring.position.y = 0.06;
  group.add(ring);

  const pose = makePose(DEF);
  const P = pose.cur;
  let spin = 0;

  function animate(anim, t, dt, speed) {
    if (anim === 'frozen') return;
    dt = Math.min(dt || 0.016, 0.1);
    const key = SPECS[anim] ? anim : (ALIAS[anim] || 'idle');
    applySpec(pose, SPECS[key]);
    stepPose(pose, dt, 3.5);
    spin += dt * P.spin;

    inner.position.y = -0.8 + P.bob * Math.sin(t * 1.3) + Math.sin(t * 0.37) * 0.02;
    tilt.rotation.x = P.tilt + Math.sin(t * 0.7) * 0.02;
    tilt.rotation.z = Math.sin(t * 0.5) * 0.03;
    const sh = P.shudder;
    tilt.position.x = Math.sin(t * 61) * 0.025 * sh;
    tilt.position.z = Math.cos(t * 53) * 0.02 * sh;
    skirt.rotation.y = spin;
    ring.rotation.y = -spin * 0.5;
    ring.position.y = 0.06 + Math.sin(t * 1.3) * 0.015;

    const pulse = 1 + Math.sin(t * 2.2) * P.eyePulse;
    let strobe = 1;
    if (P.strobe > 0.05) strobe = Math.sin(t * 38) > -0.2 ? 1 : 0.05 + (1 - P.strobe) * 0.95;
    const es = P.eye * pulse * strobe;
    eyes[0].scale.set(0.062 * es, 0.085 * es, 0.03);
    eyes[1].scale.set(0.062 * es, 0.085 * es, 0.03);
    eyeM.color.setRGB(1, 0.62 + 0.3 * Math.min(1, (P.eye - 1) * 1.5 + (strobe > 0.5 ? 0.0 : 0)), 0.3 + 0.35 * Math.max(0, P.eye - 1));
    glowM.opacity = P.glow * (0.8 + 0.2 * Math.sin(t * 1.7));

    headPivot.rotation.x = Math.sin(t * 0.6) * 0.03 - P.tilt * 0.3;
    headPivot.rotation.y = Math.sin(t * 0.33) * 0.12;

    for (let a = 0; a < 2; a++) {
      const A = arms[a];
      A.shp.rotation.x = -P.armF + Math.sin(t * 0.9 + a) * 0.05 + Math.sin(t * 47 + a) * 0.03 * sh;
      A.shp.rotation.z = A.side * (0.18 + Math.sin(t * 0.7 + a) * 0.04);
      A.el.rotation.x = -P.elbow;
      A.hand.rotation.x = -0.2 + Math.sin(t * 1.2 + a) * 0.1;
      for (let c = 0; c < 3; c++) {
        A.claws[c].rotation.x = -(P.claw * 0.6 + (0.5 + 0.5 * Math.sin(t * 2.4 + c * 0.9 + a * 1.7)) * P.claw * 0.8);
        A.claws[c].rotation.z = (c - 1) * 0.18;
      }
    }
  }

  animate('idle', 0, 0.016, 0);
  return { group, height: 3.07, eyeHeight: 2.3, animate };
}
