import * as THREE from 'three';
import {
  clamp, prng, canvasTex, stdMat, glowMat, warp, ellipsoid, limbGeo, stalkGeo, zGeo,
  add, pivot, bone, polyGeo, Rig, P,
} from './_helpersB.js';

function skinTex() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = prng(31);
    g.fillStyle = '#3b2a24'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const l = 25 + r() * 40;
      g.fillStyle = `rgba(${l + 25},${l + 8},${l + 2},${0.12 + r() * 0.2})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 5, 1 + r() * 3, r() * 3, 0, 6.3); g.fill();
    }
  }, 2, 2);
}
function membraneTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = prng(9);
    g.fillStyle = '#2a1c1b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = `rgba(${60 + r() * 50},${30 + r() * 20},${28 + r() * 15},${0.06 + r() * 0.12})`;
      g.fillRect(r() * w, r() * h, 3 + r() * 14, 1 + r() * 3);
    }
    g.strokeStyle = 'rgba(8,4,4,0.6)';
    for (let i = 0; i < 12; i++) {
      g.lineWidth = 1 + r() * 2;
      g.beginPath(); g.moveTo(w * r() * 0.3, h * r());
      g.bezierCurveTo(w * 0.4, h * r(), w * 0.7, h * r(), w, h * r()); g.stroke();
    }
  });
}

export function build() {
  const group = new THREE.Group();
  const rig = new Rig();
  const skin = stdMat(0x5a463e, 0.9, { map: skinTex() });
  const memb = stdMat(0xffffff, 0.8, { map: membraneTex(), side: THREE.DoubleSide, flatShading: false });
  const bone_ = stdMat(0x1c1612, 0.7);
  const eyeM = glowMat(0xff3a14);
  const J = {};

  // ---- body -------------------------------------------------------------
  const hips = pivot(group, 0, 0.95, 0);
  J.hips = rig.add(hips);
  add(hips, warp(ellipsoid(0.17, 0.17, 0.2, 9, 7), 0.02, 5, 1), skin);
  const spine = pivot(hips, 0, 0.02, 0);
  J.spine = rig.add(spine);
  add(spine, warp(ellipsoid(0.2, 0.3, 0.17, 10, 8), 0.025, 5, 2), skin, 0, 0.3, 0);

  // neck + head
  const n1 = pivot(spine, 0, 0.5, 0); J.n1 = rig.add(n1);
  add(n1, stalkGeo(0.075, 0.055, 0.27, 6), skin);
  const n2 = pivot(n1, 0, 0.27, 0); J.n2 = rig.add(n2);
  add(n2, stalkGeo(0.055, 0.05, 0.27, 6), skin);
  const head = pivot(n2, 0, 0.27, 0); J.head = rig.add(head);
  const skull = add(head, zGeo(0.095, 0.045, 0.48, 7), skin, 0, -0.02, -0.08);
  skull.scale.x = 0.82;
  const jaw = pivot(head, 0, -0.065, -0.02); J.jaw = rig.add(jaw);
  add(jaw, zGeo(0.04, 0.026, 0.4, 6), bone_, 0, 0, 0);
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.021, 8, 6), eyeM, s * 0.074, 0.025, 0.04);
    // curled ram-ish horn sweeping back and down
    const horn = add(head, new THREE.TorusGeometry(0.15, 0.024, 5, 12, 4.4), bone_, s * 0.07, 0.08, -0.04);
    horn.rotation.set(0, Math.PI / 2, 0);
    horn.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), s * 0.35);
  }

  // forearms held tight to the chest
  J.arm = []; J.fore = [];
  for (const s of [-1, 1]) {
    const sh = pivot(spine, s * 0.14, 0.42, 0.06);
    add(sh, limbGeo(0.032, 0.026, 0.2, 5), skin);
    const el = pivot(sh, 0, -0.2, 0);
    add(el, limbGeo(0.026, 0.012, 0.2, 5), skin);
    add(el, limbGeo(0.012, 0.0, 0.1, 4), bone_, 0, -0.2, 0);
    J.arm.push(rig.add(sh)); J.fore.push(rig.add(el));
  }

  // hooved digitigrade hind legs
  J.th = []; J.sn = []; J.ca = []; J.ho = [];
  for (const s of [-1, 1]) {
    const th = pivot(hips, s * 0.12, -0.02, 0);
    add(th, limbGeo(0.07, 0.045, 0.38, 6), skin);
    const sn = pivot(th, 0, -0.38, 0);
    add(sn, limbGeo(0.045, 0.03, 0.38, 6), skin);
    const ca = pivot(sn, 0, -0.38, 0);
    add(ca, limbGeo(0.03, 0.022, 0.34, 5), skin);
    const ho = pivot(ca, 0, -0.34, 0);
    add(ho, limbGeo(0.03, 0.04, 0.07, 5), bone_);
    J.th.push(rig.add(th)); J.sn.push(rig.add(sn)); J.ca.push(rig.add(ca)); J.ho.push(rig.add(ho));
  }

  // forked tail
  const t1 = pivot(hips, 0, 0.0, -0.14); t1.rotation.x = 1.15; J.t1 = rig.add(t1);
  add(t1, limbGeo(0.05, 0.035, 0.45, 5), skin);
  const t2 = pivot(t1, 0, -0.45, 0); t2.rotation.x = -0.45; J.t2 = rig.add(t2);
  add(t2, limbGeo(0.035, 0.022, 0.4, 5), skin);
  const t3 = pivot(t2, 0, -0.4, 0); t3.rotation.x = -0.3; J.t3 = rig.add(t3);
  for (const s of [-1, 1]) {
    const f = add(t3, limbGeo(0.022, 0.0, 0.3, 4), bone_);
    f.rotation.z = s * 0.4;
  }

  // ---- wings (bat) ------------------------------------------------------
  const innerV = [0, 0, 0, 0.5, 0, 0, 0.5, -0.03, -0.7, 0.25, -0.06, -0.82, 0, -0.1, -0.9];
  const innerT = [0, 1, 2, 0, 2, 3, 0, 3, 4];
  const innerUV = [];
  for (let i = 0; i < innerV.length; i += 3) innerUV.push(innerV[i] * 1.4, -innerV[i + 2] * 1.1);
  const outV = [
    0, 0, 0, 0.5, 0, 0, 1.0, 0, -0.02, 0.78, -0.02, -0.22, 0.9, -0.04, -0.5,
    0.62, -0.045, -0.6, 0.6, -0.05, -0.85, 0.3, -0.05, -0.62, 0, -0.03, -0.7,
  ];
  const outT = [1, 2, 3, 1, 3, 4, 1, 4, 5, 1, 5, 6, 1, 6, 7, 1, 7, 8, 1, 8, 0];
  const outUV = [];
  for (let i = 0; i < outV.length; i += 3) outUV.push(outV[i], -outV[i + 2] * 1.1);
  const innerG = polyGeo(innerV, innerT, innerUV);
  const outG = polyGeo(outV, outT, outUV);

  J.ws = []; J.we = [];
  for (const s of [1, -1]) {
    const mount = pivot(spine, s * 0.11, 0.42, -0.1);
    mount.scale.x = s;
    const ws = pivot(mount);
    add(ws, innerG, memb);
    bone(ws, [0, 0, 0], [0.5, 0, 0], 0.03, 0.022, bone_);
    const we = pivot(ws, 0.5, 0, 0);
    add(we, outG, memb);
    bone(we, [0, 0, 0], [0.5, 0, 0], 0.022, 0.016, bone_);
    bone(we, [0.5, 0, 0], [1.0, 0, -0.02], 0.016, 0.005, bone_, 4);
    bone(we, [0.5, 0, 0], [0.9, -0.04, -0.5], 0.014, 0.005, bone_, 4);
    bone(we, [0.5, 0, 0], [0.6, -0.05, -0.85], 0.013, 0.005, bone_, 4);
    J.ws.push(rig.add(ws)); J.we.push(rig.add(we));
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ---- animation --------------------------------------------------------
  function animate(anim, t, dt, speed) {
    const sp = speed || 0;
    const L = anim === 'frozen' ? 0 : 1;
    let a = anim;
    if (a === 'frozen' || !a) a = 'idle';
    if (a === 'crawl') a = 'walk';
    rig.reset();
    let rate = 7;

    // defaults = standing, wings half open
    let spine_ = 0.45, nk1 = 0.5, nk2 = 0.9, hd = 0.6, jawO = 0.05;
    let wsz = 0.15, wsy = 0.35, wsx = 0, wez = -0.1, wey = 0.95;
    let flap = 0, fw = 0, legA = 0, gf = 0, lean = 0, hipsY = 0, thB = 0, snB = 0;
    let paw = 0;

    if (a === 'idle') {
      const bob = Math.sin(t * 1.3) * L;
      nk1 += 0.05 * bob; nk2 += 0.08 * Math.sin(t * 1.3 + 0.8) * L; hd += 0.12 * bob;
      jawO += 0.03 * Math.sin(t * 0.7) * L;
      wsz += 0.05 * Math.sin(t * 0.9) * L;
      const g = Math.sin(t * 2.4);
      paw = L * Math.max(0, Math.sin(t * 0.55)) * Math.max(0, g);
    } else if (a === 'special') {
      rate = 9;
      const sh = Math.sin(t * 26) * L;
      spine_ = -0.15; nk1 = -0.55; nk2 = -0.95; hd = -1.3; jawO = 0.85;
      wsz = 0.45 + 0.04 * sh; wsy = -0.3; wez = 0.15; wey = -0.05;
      thB = 0.35; snB = 0.4; hipsY = -0.12;
    } else {
      // walk / run / fly / attack: body pitched horizontal, neck stretched forward
      rate = a === 'walk' ? 7 : 11;
      const run = a !== 'walk';
      spine_ = a === 'walk' ? 0.8 : 1.25;
      nk1 = spine_ + 0.1; nk2 = spine_ + 0.2; hd = a === 'walk' ? 0.6 : 0.25;
      jawO = a === 'attack' ? 1.0 : 0.12;
      wsz = 0.15; wsy = run ? 1.0 : 0.6; wez = -0.1; wey = run ? 0.7 : 0.9;
      const w = t * (a === 'fly' ? 11 : 8);
      flap = a === 'fly' ? 0.7 : 0.18; fw = w;
      legA = clamp(0.4 + sp * 0.06, 0.4, 1.1);
      gf = t * (6 + sp * 0.5);
      hipsY = 0.04;
    }

    // wings
    for (let i = 0; i < 2; i++) {
      const f = Math.sin(fw + i * 0.15);
      P(J.ws[i], wsx, wsy - 0.25 * flap * f, wsz + flap * f);
      P(J.we[i], 0, wey, wez - 0.45 * flap * Math.sin(fw - 0.9));
    }

    const live = L;
    const br = Math.sin(t * 1.9) * 0.015 * live;
    P(J.hips, a === 'walk' || a === 'run' || a === 'fly' || a === 'attack' ? 0.05 * Math.sin(gf * 1.0) : 0, 0, 0, 0, hipsY + br + (legA ? 0.05 * Math.abs(Math.sin(gf)) : 0), 0);
    P(J.spine, spine_, 0.03 * Math.sin(t * 0.8) * live, 0);
    P(J.n1, nk1 - spine_, 0, 0);
    P(J.n2, nk2 - nk1, 0, 0);
    P(J.head, hd - nk2, 0.05 * Math.sin(t * 0.6) * live, 0);
    P(J.jaw, jawO, 0, 0);

    // arms tucked
    for (let i = 0; i < 2; i++) {
      P(J.arm[i], 0.1 + 0.05 * Math.sin(t * 5 + i) * live * (legA ? 1 : 0.3), 0, 0.12 * (i ? 1 : -1));
      P(J.fore[i], -2.2, 0, 0);
    }

    // legs
    for (let i = 0; i < 2; i++) {
      const s = Math.sin(gf + i * 0.55);
      const lift = Math.max(0, Math.cos(gf + i * 0.55));
      let th = thB + legA * 0.9 * s, sn = snB + legA * 0.7 * lift, ca = -legA * 0.4 * lift, ho = 0.1 * lift;
      if (i === 1 && paw > 0) { th -= 0.55 * paw; sn += 0.7 * paw; ca -= 0.4 * paw * Math.sin(t * 9); }
      P(J.th[i], -0.55 + th, 0, 0);
      P(J.sn[i], 1.15 + sn, 0, 0);
      P(J.ca[i], -0.6 + ca, 0, 0);
      P(J.ho[i], ho + 0.0, 0, 0);
    }

    // tail
    const ts = live * Math.sin(t * 2 + 1) * 0.15;
    const raise = legA ? 0.4 : 0;
    P(J.t1, raise, ts, 0);
    P(J.t2, 0.1 * Math.sin(t * 3) * live, ts * 1.5, 0);
    P(J.t3, 0.15 * Math.sin(t * 3.7 + 1) * live, ts * 2, 0);

    rig.apply(dt, rate);
  }

  return { group, height: 1.92, eyeHeight: 1.66, animate };
}
