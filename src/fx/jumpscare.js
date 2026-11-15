// Scripted ~1.7 s death jumpscare. Drives camera, creature placement and a temp point light.
import * as THREE from 'three';

const DURATION = 1.7;
const FADE_LEN = 0.5;

const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

// S: shared fx state { fade, pulse, red } that index.js decays/uses.
export function createJumpscare(ctx, S) {
  const light = new THREE.PointLight(0xffe2c8, 0, 7, 2);
  light.castShadow = false;
  ctx.scene.add(light);

  const st = {
    active: false,
    t: 0,
    creature: null,
    onDone: null,
    done: false,
    p1: false, p2: false,
    baseFov: 72,
  };
  const basePos = new THREE.Vector3();
  const baseQuat = new THREE.Quaternion();
  const fwd = new THREE.Vector3(0, 0, -1);
  const head = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const mat = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const qT = new THREE.Quaternion();
  const qS = new THREE.Quaternion();
  const eul = new THREE.Euler(0, 0, 0, 'YXZ');

  function start(creature, onDone, baseFov = 72) {
    const cam = ctx.camera;
    st.active = true; st.t = 0; st.done = false; st.p1 = false; st.p2 = false;
    st.creature = creature || null;
    st.onDone = onDone || null;
    st.baseFov = baseFov;
    cam.updateMatrixWorld(true);
    cam.getWorldPosition(basePos);
    cam.getWorldQuaternion(baseQuat);
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    S.fade = 0;
    S.pulse = 1;
    S.red = 1;
    try { ctx.audio?.play?.('death'); } catch (e) { /* ignore */ }
    if (creature) {
      creature.anim = 'attack';
      creature.frozen = true;
      if (creature.group) creature.group.visible = true;
    }
  }

  function place(c, dist) {
    const g = c.group;
    if (!g) return false;
    const eh = c.model?.eyeHeight ?? 1.7;
    g.position.set(basePos.x + fwd.x * dist, basePos.y - eh, basePos.z + fwd.z * dist);
    g.rotation.y = Math.atan2(-fwd.x, -fwd.z);
    c.anim = 'attack';
    c.frozen = true;
    g.updateMatrixWorld(true);
    let h = null;
    try { h = c.headPos ? c.headPos(head) : null; } catch (e) { h = null; }
    if (h && h !== head) head.copy(h);
    if (!h) head.set(g.position.x, basePos.y, g.position.z);
    return true;
  }

  // returns true while it owns the camera
  function step(dt) {
    if (!st.active) return false;
    const cam = ctx.camera;
    st.t += dt;
    const t = st.t;

    // timed bursts
    if (!st.p1 && t > 0.4) { st.p1 = true; S.pulse = Math.max(S.pulse, 0.75); S.red = Math.max(S.red, 0.5); }
    if (!st.p2 && t > 0.9) { st.p2 = true; S.pulse = Math.max(S.pulse, 0.6); }

    const decay = Math.exp(-t * 2.0);
    const shakeX = (Math.sin(t * 61) + 0.7 * Math.sin(t * 43 + 1.3)) * (0.05 * decay + 0.006);
    const shakeY = (Math.sin(t * 53 + 2.1) + 0.7 * Math.sin(t * 37)) * (0.05 * decay + 0.006);
    eye.set(basePos.x + shakeX, basePos.y + shakeY, basePos.z + shakeX * 0.5);

    let placed = false;
    if (st.creature) {
      const lunge = 1.7 - 0.6 * easeOut(t / 0.16);
      placed = place(st.creature, lunge);
    }

    const k = easeOut(t / 0.14);
    if (placed) {
      mat.lookAt(eye, head, up);
      qT.setFromRotationMatrix(mat);
      cam.quaternion.slerpQuaternions(baseQuat, qT, k);
    } else {
      cam.quaternion.copy(baseQuat);
    }
    const roll = 0.2 * Math.exp(-t * 1.6) * Math.sin(t * 29 + 0.5) + 0.07 * Math.sin(t * 11) + 0.09 * k;
    eul.set(
      0.05 * decay * Math.sin(t * 47 + 0.7),
      0.05 * decay * Math.sin(t * 41 + 2.0),
      roll,
    );
    qS.setFromEuler(eul);
    cam.quaternion.multiply(qS);
    cam.position.copy(eye);

    // FOV kick
    const fov = st.baseFov + 16 * Math.exp(-t * 6);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }

    // face light
    const strobe = 0.6 + 0.4 * (Math.sin(t * 70) > -0.2 ? 1 : 0.35);
    const lightFade = 1 - Math.min(1, Math.max(0, (t - (DURATION - FADE_LEN)) / FADE_LEN)) * 0.5;
    light.position.set(basePos.x + fwd.x * 0.45, basePos.y + 0.25, basePos.z + fwd.z * 0.45);
    light.intensity = 3.2 * strobe * lightFade * Math.min(1, t / 0.04);

    // fade to black
    if (t > DURATION - FADE_LEN) S.fade = Math.min(1, (t - (DURATION - FADE_LEN)) / FADE_LEN);

    if (t >= DURATION) {
      st.active = false;
      S.fade = 1;
      light.intensity = 0;
      if (!st.done) {
        st.done = true;
        const cb = st.onDone;
        st.onDone = null;
        if (cb) cb();
      }
    }
    return true;
  }

  function reset() {
    st.active = false; st.done = false; st.creature = null; st.onDone = null; st.t = 0;
    light.intensity = 0;
  }

  return { st, step, start, reset, get active() { return st.active; } };
}
