// First-person view-model: forearm + flashlight, and a Y-fork slingshot when drawing.
import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function setBand(mesh, a, b) {
  _dir.subVectors(b, a);
  const len = _dir.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.scale.set(1, Math.max(0.001, len), 1);
  mesh.quaternion.setFromUnitVectors(_up, _dir.multiplyScalar(1 / Math.max(len, 1e-5)));
}

export function createViewModel(ctx, player) {
  const group = new THREE.Group();
  group.name = 'viewmodel';
  const skin = new THREE.MeshStandardMaterial({ color: 0x2a1f19, roughness: 0.9 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x0b0d0a, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.55, metalness: 0.3 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x888070,
    roughness: 0.2,
    emissive: 0xffe2a8,
    emissiveIntensity: 0,
  });
  const wood = new THREE.MeshStandardMaterial({ color: 0x20150c, roughness: 0.9 });
  const band = new THREE.MeshStandardMaterial({ color: 0x140e0c, roughness: 0.8 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.95, flatShading: true });

  const mk = (geo, mat, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = false;
    m.receiveShadow = false;
    m.frustumCulled = false;
    parent.add(m);
    return m;
  };

  // --- flashlight arm ---
  const arm = new THREE.Group();
  group.add(arm);
  const forearm = mk(new THREE.CylinderGeometry(0.04, 0.052, 0.5, 10).rotateX(Math.PI / 2), sleeve, arm);
  forearm.position.set(0.0, -0.035, 0.27);
  forearm.rotation.x = 0.12;
  const cuff = mk(new THREE.BoxGeometry(0.075, 0.075, 0.06), skin, arm);
  cuff.position.set(0, -0.012, 0.04);
  const hand = mk(new THREE.BoxGeometry(0.09, 0.085, 0.1), skin, arm);
  hand.position.set(0, 0.0, -0.04);
  const thumb = mk(new THREE.BoxGeometry(0.025, 0.03, 0.07), skin, arm);
  thumb.position.set(-0.04, 0.045, -0.06);
  const body = mk(new THREE.CylinderGeometry(0.032, 0.036, 0.22, 10), metal, arm);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.002, -0.14);
  const head = mk(new THREE.CylinderGeometry(0.05, 0.036, 0.075, 12), metal, arm);
  head.rotation.x = Math.PI / 2;
  head.position.set(0, 0.002, -0.28);
  const lens = mk(new THREE.CircleGeometry(0.043, 12), lensMat, arm);
  lens.position.set(0, 0.002, -0.3185);
  lens.rotation.y = Math.PI;
  const tail = mk(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 8), metal, arm);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.002, -0.02);

  // --- slingshot ---
  const sling = new THREE.Group();
  sling.visible = false;
  group.add(sling);
  const handle = mk(new THREE.CylinderGeometry(0.014, 0.018, 0.17, 6), wood, sling);
  handle.position.set(0, -0.02, 0);
  const prongL = mk(new THREE.CylinderGeometry(0.011, 0.014, 0.13, 6), wood, sling);
  prongL.position.set(-0.04, 0.12, 0);
  prongL.rotation.z = -0.38;
  const prongR = mk(new THREE.CylinderGeometry(0.011, 0.014, 0.13, 6), wood, sling);
  prongR.position.set(0.04, 0.12, 0);
  prongR.rotation.z = 0.38;
  const slingHand = mk(new THREE.BoxGeometry(0.075, 0.07, 0.08), skin, sling);
  slingHand.position.set(0, -0.04, 0);
  const slingArm = mk(new THREE.CylinderGeometry(0.036, 0.05, 0.5, 10).rotateX(Math.PI / 2), sleeve, sling);
  slingArm.position.set(0, -0.08, 0.28);
  slingArm.rotation.x = 0.2;
  const bandL = mk(new THREE.CylinderGeometry(0.004, 0.004, 1, 4), band, sling);
  const bandR = mk(new THREE.CylinderGeometry(0.004, 0.004, 1, 4), band, sling);
  const pouch = mk(new THREE.BoxGeometry(0.03, 0.02, 0.012), band, sling);
  const pouchRock = mk(new THREE.IcosahedronGeometry(0.018, 0), rockMat, sling);
  const tipL = new THREE.Vector3(-0.073, 0.18, 0);
  const tipR = new THREE.Vector3(0.073, 0.18, 0);
  const pouchPos = new THREE.Vector3();
  // pull hand
  const pullHand = mk(new THREE.BoxGeometry(0.05, 0.05, 0.06), skin, sling);

  const vm = {
    group,
    drawing: false, // set by items.js
    charge: 0, // 0..1, set by items.js
    _raise: 0,
    _kick: 0,
    _t: 0,
    _bobX: 0,
    _bobY: 0,
    kick() {
      vm._kick = 0.28;
    },
    reset() {
      vm.drawing = false;
      vm.charge = 0;
      vm._raise = 0;
      vm._kick = 0;
    },
    // s: { speed(0..), phase (steps), sprint, crouch, on }
    update(dt, s) {
      vm._t += dt;
      const t = vm._t;
      const k = 1 - Math.exp(-dt * 12);
      vm._raise += ((vm.drawing ? 1 : 0) - vm._raise) * k;
      const raise = vm._raise;
      const e = raise * raise * (3 - 2 * raise);

      const sp = Math.min(1.6, s.speed / 3.4);
      const ph = s.phase * Math.PI * 2;
      const bx = Math.sin(ph * 0.5) * 0.012 * sp;
      const by = -Math.abs(Math.sin(ph * 0.5)) * 0.016 * sp;
      const idleY = Math.sin(t * 1.4) * 0.0025;
      const idleX = Math.sin(t * 0.9) * 0.0018;
      let kickF = 0;
      if (vm._kick > 0) {
        vm._kick = Math.max(0, vm._kick - dt);
        kickF = Math.sin((1 - vm._kick / 0.28) * Math.PI);
      }
      const sprintPush = s.sprint ? 1 : 0;
      vm._bobX += (bx + idleX - vm._bobX) * Math.min(1, dt * 20);
      vm._bobY += (by + idleY - vm._bobY) * Math.min(1, dt * 20);

      group.position.set(0.0, 0.0, 0.0);
      arm.position.set(
        0.27 + vm._bobX,
        -0.27 + vm._bobY - e * 0.32 - kickF * 0.02 - (s.crouch ? 0.01 : 0),
        -0.5 + kickF * 0.0 + sprintPush * 0.02
      );
      arm.rotation.set(-0.1 + kickF * 0.35 + sprintPush * 0.12 + e * 0.5, 0.12 + e * 0.4, -e * 0.4 + Math.sin(ph * 0.5) * 0.02 * sp);

      lensMat.emissiveIntensity = s.on ? 2.2 * (s.mul ?? 1) : 0;

      sling.visible = raise > 0.02;
      if (sling.visible) {
        const c = vm.charge;
        sling.position.set(0.04, -0.3 - (1 - e) * 0.45 + vm._bobY, -0.62 + c * 0.03);
        sling.rotation.set(-0.18, 0, 0);
        pouchPos.set(0, 0.17, 0.03 + c * 0.2);
        setBand(bandL, tipL, pouchPos);
        setBand(bandR, tipR, pouchPos);
        pouch.position.copy(pouchPos);
        pouchRock.position.copy(pouchPos);
        pouchRock.position.z -= 0.01;
        pullHand.position.set(0.0, 0.15, pouchPos.z + 0.045);
        pullHand.visible = c > 0.02;
        // small tremble at full draw
        if (c > 0.95) sling.position.x += Math.sin(t * 40) * 0.0012;
      }
    },
  };
  return vm;
}
