// Fresno Nightcrawler: two long pale rubbery legs, a small lump on top, no arms, no face.
import * as THREE from 'three';
import { canvasTex, rng, makePose, applySpec, stepPose, taperGeo, sphereGeo, mk, ellipsoid, clamp } from './_helpersC.js';

const DEF = { freq: 0.6, stride: 0.1, bend: 0.1, curve: 0.03, bob: 0.006, lean: 0, tilt: 0.3, nod: 0.05, stretch: 0, shift: 0.05, wob: 0.5, hb: 0.15 };
const SPECS = {
  idle: DEF,
  walk: { freq: 2.4, stride: 0.5, bend: 0.17, curve: 0.04, bob: 0.012, lean: 0.05, tilt: 0.05, nod: 0.1, stretch: 0, shift: 0.025, wob: 1, hb: 1 },
  run: { freq: 5.6, stride: 0.95, bend: 0.27, curve: 0.06, bob: 0.02, lean: 0.2, tilt: 0, nod: 0.2, stretch: 0, shift: 0.015, wob: 1.6, hb: 1.6 },
  special: { freq: 0.3, stride: 0.02, bend: 0.04, curve: 0.01, bob: 0, lean: -0.04, tilt: -0.1, nod: -0.25, stretch: 0.3, shift: 0, wob: 0.2, hb: 0 },
};
const REF = { walk: 1.4, run: 5.5 };
const ALIAS = { crawl: 'walk', fly: 'walk', attack: 'run' };

export function build() {
  const R = rng(77);
  const skinTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#d8d4c8';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = R() * w, y = R() * h, r = 8 + R() * 30;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const c = R() < 0.5 ? '190,170,165' : '235,235,225';
      grd.addColorStop(0, `rgba(${c},0.25)`);
      grd.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.strokeStyle = 'rgba(150,120,130,0.12)';
    for (let i = 0; i < 18; i++) {
      g.beginPath();
      let x = R() * w, y = R() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 20; y += R() * 25; g.lineTo(x, y); }
      g.stroke();
    }
  });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe6e2d6, map: skinTex, roughness: 0.42, metalness: 0, emissive: 0x0d0d0e });
  const dimple = new THREE.MeshStandardMaterial({ color: 0x3b3438, roughness: 1 });

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // legs
  const N = 6, SEG = 0.195;
  const radii = [0.072, 0.064, 0.055, 0.047, 0.04, 0.036, 0.04];
  const legs = [];
  for (let l = 0; l < 2; l++) {
    const hip = new THREE.Group();
    hip.position.set(l === 0 ? 0.075 : -0.075, 1.18, 0);
    body.add(hip);
    const segs = [];
    let parent = hip;
    for (let i = 0; i < N; i++) {
      const sg = new THREE.Group();
      if (i > 0) sg.position.y = -SEG;
      parent.add(sg);
      if (i > 0) sg.add(mk(sphereGeo(radii[i], 10, 7), skin));
      sg.add(mk(taperGeo(radii[i], radii[i + 1], SEG, 10), skin));
      segs.push(sg);
      parent = sg;
    }
    const foot = ellipsoid(skin, 0.05, 0.03, 0.085, true, 10, 7);
    foot.position.set(0, -SEG + 0.015, 0.025);
    parent.add(foot);
    legs.push({ hip, segs });
  }

  // torso / head lump
  const hips = ellipsoid(skin, 0.14, 0.1, 0.1);
  hips.position.y = 1.2;
  body.add(hips);
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.27;
  body.add(headPivot);
  const chest = ellipsoid(skin, 0.1, 0.11, 0.085);
  chest.position.y = 0.04;
  headPivot.add(chest);
  const head = ellipsoid(skin, 0.074, 0.08, 0.072);
  head.position.y = 0.155;
  headPivot.add(head);
  for (const s of [-1, 1]) {
    const d = ellipsoid(dimple, 0.014, 0.012, 0.006, false, 8, 6);
    d.position.set(s * 0.028, 0.17, 0.066);
    headPivot.add(d);
  }

  const pose = makePose(DEF);
  const st = { ph: 0 };
  const P = pose.cur;

  function animate(anim, t, dt, speed) {
    if (anim === 'frozen') return;
    dt = Math.min(dt || 0.016, 0.1);
    const key = SPECS[anim] ? anim : (ALIAS[anim] || 'idle');
    applySpec(pose, SPECS[key]);
    if (REF[key] && speed > 0.05) pose.tgt.freq *= clamp(speed / REF[key], 0.6, 1.7);
    if (key === 'special' && t % 6 < 0.9) { pose.tgt.stretch = 0; pose.tgt.tilt = 0; pose.tgt.nod = 0; }
    stepPose(pose, dt, 3.5);
    st.ph += dt * P.freq;
    const ph = st.ph;

    const sp = Math.sin(ph);
    for (let l = 0; l < 2; l++) {
      const lp = ph + l * Math.PI;
      const leg = legs[l];
      const side = l === 0 ? 1 : -1;
      leg.hip.rotation.x = Math.sin(lp) * P.stride;
      leg.hip.rotation.z = side * 0.02 + Math.sin(ph * 0.5 + l * 2) * 0.05 * P.wob;
      for (let i = 0; i < N; i++) {
        const sg = leg.segs[i];
        sg.rotation.x = P.curve + Math.sin(lp - 0.8 * (i + 1) + Math.sin(t * 0.7 + l) * 0.4) * P.bend * (0.5 + 0.25 * i);
        sg.rotation.z = Math.sin(ph * 0.7 + i * 0.9 + l * 2.1) * 0.05 * P.wob;
      }
    }
    body.position.y = -1.1 * 0.7 * (1 - Math.cos(P.stride * sp)) + P.bob * Math.sin(ph * 2);
    body.position.x = Math.sin(ph * 0.5) * P.shift;
    body.rotation.z = Math.sin(ph * 0.5) * P.shift * 0.8;
    body.rotation.x = P.lean;
    body.scale.set(1 - P.stretch * 0.15, 1 + P.stretch, 1 - P.stretch * 0.15);

    const wob = Math.sin(ph * 2 + 1) * 0.05 * P.wob;
    const br = Math.sin(t * 1.6) * 0.02;
    chest.scale.set(0.1 * (1 + wob + br), 0.11 * (1 - wob), 0.085 * (1 + wob));
    headPivot.rotation.x = P.nod + Math.sin(ph * 2) * 0.12 * P.hb;
    headPivot.rotation.z = P.tilt * (0.75 + 0.25 * Math.sin(t * 0.45)) + Math.sin(ph) * 0.1 * P.hb + Math.sin(t * 0.9) * 0.03;
    headPivot.rotation.y = Math.sin(t * 0.37) * 0.12 + (key === 'idle' ? Math.sin(t * 0.21) * 0.3 : 0);
    head.position.y = 0.155 + Math.sin(ph * 2 + 0.6) * 0.01 * P.hb;
  }

  animate('idle', 0, 0.016, 0);
  return { group, height: 1.5, eyeHeight: 1.43, animate };
}
