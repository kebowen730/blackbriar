// Pickups (rock piles, batteries, slingshot) + thrown projectiles.
import * as THREE from 'three';

const MAX_ROCKS = 12;
const MAX_BATTERIES = 5;
const PICK_R2 = 1.4 * 1.4;
const ROCK_RESPAWN = 90;
const MAX_PROJ = 6;
const GRAVITY = 9.8;
const DRAW_TIME = 0.8;
const MAX_DUST = 6;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createItems(ctx) {
  const scene = ctx.scene;
  const root = new THREE.Group();
  root.name = 'items';
  scene.add(root);

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _s = new THREE.Vector3();
  const _p = new THREE.Vector3();
  const _c = new THREE.Color();
  const _v = new THREE.Vector3();
  const _start = new THREE.Vector3();
  const _dir = new THREE.Vector3();

  const groundY = (x, z, fallback = 0) => (ctx.world?.heightAt ? ctx.world.heightAt(x, z) : fallback);
  const spawns = ctx.world?.pickupSpawns || {};

  // ------------------------------------------------------------ rock piles
  const rockPiles = []; // { x,y,z, active, timer, idx:[3] }
  const rockPos = spawns.rocks || [];
  const rockGeo = new THREE.IcosahedronGeometry(0.11, 0);
  rockGeo.scale(1, 0.7, 1);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x77756f, roughness: 0.95, flatShading: true });
  const pileMesh = new THREE.InstancedMesh(rockGeo, rockMat, Math.max(1, rockPos.length * 3));
  pileMesh.frustumCulled = false;
  pileMesh.receiveShadow = true;
  pileMesh.castShadow = false;
  root.add(pileMesh);
  {
    const rnd = mulberry(9157);
    for (let i = 0; i < rockPos.length; i++) {
      const sp = rockPos[i];
      const y = groundY(sp.x, sp.z, sp.y);
      const pile = { x: sp.x, y, z: sp.z, active: true, timer: 0 };
      const n = rnd() < 0.5 ? 2 : 3;
      for (let k = 0; k < 3; k++) {
        const id = i * 3 + k;
        if (k < n) {
          const a = rnd() * Math.PI * 2;
          const d = k === 0 ? 0 : 0.12 + rnd() * 0.1;
          const sc = 0.8 + rnd() * 0.7;
          _p.set(sp.x + Math.cos(a) * d, y + 0.05 * sc, sp.z + Math.sin(a) * d);
          _q.setFromEuler(_e.set(rnd() * 0.6, rnd() * 6.28, rnd() * 0.6));
          _s.set(sc, sc * (0.8 + rnd() * 0.4), sc);
          pileMesh.setMatrixAt(id, _m.compose(_p, _q, _s));
        } else {
          pileMesh.setMatrixAt(id, _m.makeScale(0, 0, 0));
        }
      }
      rockPiles.push(pile);
    }
  }
  const pileBase = pileMesh.instanceMatrix.array.slice();
  const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);

  function setPileVisible(i, vis) {
    const arr = pileMesh.instanceMatrix.array;
    for (let k = 0; k < 3; k++) {
      const o = (i * 3 + k) * 16;
      if (vis) for (let j = 0; j < 16; j++) arr[o + j] = pileBase[o + j];
      else for (let j = 0; j < 16; j++) arr[o + j] = ZERO_M.elements[j];
    }
    pileMesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ batteries
  const batPos = spawns.batteries || [];
  const batteries = []; // { x,y,z, active }
  const batGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8);
  const batMat = new THREE.MeshStandardMaterial({ color: 0x9a6a2e, roughness: 0.5, metalness: 0.5 });
  const batMesh = new THREE.InstancedMesh(batGeo, batMat, Math.max(1, batPos.length));
  batMesh.frustumCulled = false;
  batMesh.receiveShadow = true;
  root.add(batMesh);
  const ledGeo = new THREE.SphereGeometry(0.022, 6, 4);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false });
  const ledMesh = new THREE.InstancedMesh(ledGeo, ledMat, Math.max(1, batPos.length));
  ledMesh.frustumCulled = false;
  root.add(ledMesh);
  for (let i = 0; i < Math.max(1, batPos.length); i++) ledMesh.setColorAt(i, _c.setRGB(0, 0, 0));
  const batBase = new Float32Array(Math.max(1, batPos.length) * 16);
  const ledBase = new Float32Array(Math.max(1, batPos.length) * 16);
  {
    const rnd = mulberry(4242);
    for (let i = 0; i < batPos.length; i++) {
      const sp = batPos[i];
      const y = groundY(sp.x, sp.z, sp.y);
      batteries.push({ x: sp.x, y, z: sp.z, active: true, phase: rnd() });
      const yawR = rnd() * Math.PI * 2;
      _q.setFromEuler(_e.set(0, yawR, Math.PI / 2));
      _p.set(sp.x, y + 0.035, sp.z);
      _s.set(1, 1, 1);
      batMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      // LED sits on the end cap
      _v.set(0, 0.06, 0).applyQuaternion(_q);
      _p.add(_v);
      ledMesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1)));
    }
    batBase.set(batMesh.instanceMatrix.array.subarray(0, batBase.length));
    ledBase.set(ledMesh.instanceMatrix.array.subarray(0, ledBase.length));
  }

  // ------------------------------------------------------------ slingshot pickup
  const slingPick = new THREE.Group();
  {
    const wood = new THREE.MeshStandardMaterial({
      color: 0x6a4626,
      roughness: 0.85,
      emissive: 0x241406,
    });
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.2, 6), wood);
    h.position.y = -0.04;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.15, 6), wood);
    l.position.set(-0.05, 0.1, 0);
    l.rotation.z = -0.4;
    const r = l.clone();
    r.position.x = 0.05;
    r.rotation.z = 0.4;
    slingPick.add(h, l, r);
    slingPick.castShadow = false;
    root.add(slingPick);
  }
  const slingState = { active: false, x: 0, y: 0, z: 0 };
  if (spawns.slingshot) {
    slingState.x = spawns.slingshot.x;
    slingState.z = spawns.slingshot.z;
    slingState.y = groundY(slingState.x, slingState.z, spawns.slingshot.y);
    slingState.active = true;
  }
  slingPick.visible = slingState.active;

  // ------------------------------------------------------------ projectiles
  const projGeo = new THREE.IcosahedronGeometry(0.075, 0);
  const projMat = new THREE.MeshStandardMaterial({ color: 0x84827c, roughness: 0.9, flatShading: true });
  const projs = [];
  for (let i = 0; i < MAX_PROJ; i++) {
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    root.add(mesh);
    projs.push({
      mesh,
      active: false,
      kind: 'rock',
      age: 0,
      vel: new THREE.Vector3(),
      spin: new THREE.Vector3(),
    });
  }

  // dust puffs
  const dustTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.8)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const dusts = [];
  for (let i = 0; i < MAX_DUST; i++) {
    const mat = new THREE.SpriteMaterial({
      map: dustTex,
      color: 0x8a8070,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    root.add(sprite);
    dusts.push({ sprite, t: 0, life: 0, size: 0 });
  }
  let dustIdx = 0;
  function puff(pos) {
    const d = dusts[dustIdx++ % MAX_DUST];
    d.t = 0;
    d.life = 0.7;
    d.size = 0.3;
    d.sprite.position.copy(pos);
    d.sprite.scale.setScalar(0.3);
    d.sprite.material.opacity = 0.5;
    d.sprite.visible = true;
  }

  function impact(pr, pos) {
    pr.active = false;
    pr.mesh.visible = false;
    const radius = pr.kind === 'slingshot' ? 46 : 34;
    ctx.bus?.emit('noise', { pos: pos.clone(), radius, kind: pr.kind });
    ctx.audio?.play('rock_impact', { pos: pos.clone() });
    puff(pos);
  }

  function launch(origin, dir, speed, kind) {
    let pr = null;
    for (let i = 0; i < projs.length; i++) {
      if (!projs[i].active) {
        pr = projs[i];
        break;
      }
    }
    if (!pr) {
      // recycle the oldest
      pr = projs[0];
      for (let i = 1; i < projs.length; i++) if (projs[i].age > pr.age) pr = projs[i];
    }
    pr.active = true;
    pr.kind = kind;
    pr.age = 0;
    pr.mesh.position.copy(origin);
    pr.vel.copy(dir).multiplyScalar(speed);
    pr.spin.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
    pr.mesh.visible = true;
  }

  function stepProjectile(pr, dt) {
    pr.age += dt;
    const pos = pr.mesh.position;
    const v = pr.vel;
    const w = ctx.world;
    const dist = v.length() * dt;
    const n = Math.max(1, Math.ceil(dist / 0.25));
    const sub = dt / n;
    const near = w?.collidersNear ? w.collidersNear(pos.x + (v.x * dt) / 2, pos.z + (v.z * dt) / 2, dist + 1.5) : null;
    for (let i = 0; i < n; i++) {
      v.y -= GRAVITY * sub;
      pos.x += v.x * sub;
      pos.y += v.y * sub;
      pos.z += v.z * sub;
      if (w?.heightAt) {
        const gh = w.heightAt(pos.x, pos.z);
        if (pos.y <= gh + 0.04) {
          pos.y = gh + 0.04;
          impact(pr, pos);
          return;
        }
      } else if (pos.y <= 0.04) {
        pos.y = 0.04;
        impact(pr, pos);
        return;
      }
      if (near) {
        for (let k = 0; k < near.length; k++) {
          const c = near[k];
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const rr = c.r + 0.07;
          if (dx * dx + dz * dz < rr * rr && pos.y < (w.heightAt ? w.heightAt(c.x, c.z) : 0) + 14) {
            impact(pr, pos);
            return;
          }
        }
      }
    }
    const lim = (w?.half ?? 180) + 40;
    if (pr.age > 8 || Math.abs(pos.x) > lim || Math.abs(pos.z) > lim) {
      pr.active = false;
      pr.mesh.visible = false;
      return;
    }
    pr.mesh.rotation.x += pr.spin.x * dt;
    pr.mesh.rotation.y += pr.spin.y * dt;
    pr.mesh.rotation.z += pr.spin.z * dt;
  }

  // ------------------------------------------------------------ input
  let drawing = false;
  let charge = 0;
  let throwCd = 0;
  let fullToast = 0;

  const canAct = () => {
    const p = ctx.player;
    return !!p && p.enabled && p.alive && ctx.state === 'playing';
  };
  const locked = () => !ctx.renderer?.domElement || document.pointerLockElement === ctx.renderer.domElement;

  function aim(spawnPos, lift, side, down) {
    const p = ctx.player;
    _dir.copy(p.forward);
    _dir.y += lift;
    _dir.normalize();
    // right = (-cos yaw, 0, sin yaw)
    _start.copy(p.eye).addScaledVector(p.forward, 0.5);
    _start.x += -Math.cos(p.yaw) * side;
    _start.z += Math.sin(p.yaw) * side;
    _start.y -= down;
    return _dir;
  }

  window.addEventListener('mousedown', (e) => {
    if (!canAct() || !locked()) return;
    const p = ctx.player;
    if (e.button === 0) {
      if (drawing || throwCd > 0 || p.inventory.rocks <= 0) return;
      p.inventory.rocks--;
      throwCd = 0.35;
      aim(null, 0.1, 0.12, 0.12);
      launch(_start, _dir, 17, 'rock');
      p.viewModel?.kick();
      ctx.audio?.play('rock_throw');
    } else if (e.button === 2) {
      if (p.inventory.hasSlingshot && p.inventory.rocks > 0) {
        drawing = true;
        charge = 0;
      }
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button !== 2 || !drawing) return;
    const p = ctx.player;
    const c = charge;
    drawing = false;
    charge = 0;
    if (p?.viewModel) {
      p.viewModel.drawing = false;
      p.viewModel.charge = 0;
    }
    if (c < 0.12 || !canAct() || p.inventory.rocks <= 0) return;
    p.inventory.rocks--;
    aim(null, 0.02, 0.1, 0.1);
    launch(_start, _dir, 30 + 22 * c, 'slingshot');
    p.viewModel?.kick();
    ctx.audio?.play('slingshot', { volume: 0.7 + 0.3 * c });
  });
  window.addEventListener('contextmenu', (e) => {
    if (document.pointerLockElement) e.preventDefault();
  });
  window.addEventListener('blur', () => {
    drawing = false;
    charge = 0;
  });

  // ------------------------------------------------------------ pickups
  function announce(type, count, msg) {
    ctx.bus?.emit('pickup', { type, count });
    ctx.audio?.play('pickup');
    ctx.ui?.toast?.(msg);
  }

  let t = 0;
  const items = {
    update(dt) {
      dt = Math.min(dt, 0.1);
      t += dt;
      throwCd = Math.max(0, throwCd - dt);
      fullToast = Math.max(0, fullToast - dt);
      const p = ctx.player;

      // projectiles
      for (let i = 0; i < projs.length; i++) if (projs[i].active) stepProjectile(projs[i], dt);
      for (let i = 0; i < dusts.length; i++) {
        const d = dusts[i];
        if (!d.sprite.visible) continue;
        d.t += dt;
        const k = d.t / d.life;
        if (k >= 1) {
          d.sprite.visible = false;
          continue;
        }
        d.sprite.scale.setScalar(0.3 + k * 0.9);
        d.sprite.position.y += dt * 0.25;
        d.sprite.material.opacity = 0.5 * (1 - k);
      }

      // slingshot draw
      if (p) {
        if (drawing) {
          if (!canAct() || p.inventory.rocks <= 0) {
            drawing = false;
            charge = 0;
          } else charge = Math.min(1, charge + dt / DRAW_TIME);
        }
        if (p.viewModel) {
          p.viewModel.drawing = drawing;
          p.viewModel.charge = charge;
        }
      }

      // LED blink + float
      if (batteries.length) {
        for (let i = 0; i < batteries.length; i++) {
          const b = batteries[i];
          if (!b.active) continue;
          const ph = (t * 0.7 + b.phase) % 1;
          const v = ph < 0.1 ? 1 : 0.06;
          ledMesh.setColorAt(i, _c.setRGB(v * 1.0, v * 0.12, v * 0.05));
        }
        ledMesh.instanceColor.needsUpdate = true;
      }
      if (slingState.active) {
        slingPick.position.set(slingState.x, slingState.y + 0.28 + Math.sin(t * 1.6) * 0.04, slingState.z);
        slingPick.rotation.y = t * 0.8;
      }

      if (!p || !p.alive) return;
      const px = p.pos.x;
      const py = p.pos.y;
      const pz = p.pos.z;

      // rock piles
      for (let i = 0; i < rockPiles.length; i++) {
        const r = rockPiles[i];
        if (!r.active) {
          r.timer -= dt;
          if (r.timer <= 0) {
            r.active = true;
            setPileVisible(i, true);
          }
          continue;
        }
        const dx = r.x - px;
        const dz = r.z - pz;
        if (dx * dx + dz * dz > PICK_R2) continue;
        const inv = p.inventory;
        if (inv.rocks >= MAX_ROCKS) {
          if (fullToast <= 0) {
            fullToast = 4;
            ctx.ui?.toast?.('You cannot carry any more rocks');
          }
          continue;
        }
        const n = Math.min(2, MAX_ROCKS - inv.rocks);
        inv.rocks += n;
        r.active = false;
        r.timer = ROCK_RESPAWN;
        setPileVisible(i, false);
        announce('rock', n, `+${n} rock${n > 1 ? 's' : ''}`);
      }

      // batteries
      for (let i = 0; i < batteries.length; i++) {
        const b = batteries[i];
        if (!b.active) continue;
        const dx = b.x - px;
        const dz = b.z - pz;
        if (dx * dx + dz * dz > PICK_R2 || Math.abs(b.y - py) > 2.5) continue;
        if (p.inventory.batteries >= MAX_BATTERIES) {
          if (fullToast <= 0) {
            fullToast = 4;
            ctx.ui?.toast?.('You cannot carry any more batteries');
          }
          continue;
        }
        p.inventory.batteries++;
        b.active = false;
        const o = i * 16;
        batMesh.instanceMatrix.array.fill(0, o, o + 16);
        ledMesh.instanceMatrix.array.fill(0, o, o + 16);
        batMesh.instanceMatrix.needsUpdate = true;
        ledMesh.instanceMatrix.needsUpdate = true;
        ledMesh.setColorAt(i, _c.setRGB(0, 0, 0));
        announce('battery', 1, 'Battery found (R to load)');
      }

      // slingshot
      if (slingState.active) {
        const dx = slingState.x - px;
        const dz = slingState.z - pz;
        if (dx * dx + dz * dz <= PICK_R2) {
          slingState.active = false;
          slingPick.visible = false;
          p.inventory.hasSlingshot = true;
          announce('slingshot', 1, 'Slingshot - hold right mouse to draw, release to fire');
        }
      }
    },

    reset() {
      drawing = false;
      charge = 0;
      throwCd = 0;
      for (const pr of projs) {
        pr.active = false;
        pr.mesh.visible = false;
      }
      for (const d of dusts) d.sprite.visible = false;
      pileMesh.instanceMatrix.array.set(pileBase);
      pileMesh.instanceMatrix.needsUpdate = true;
      for (const r of rockPiles) {
        r.active = true;
        r.timer = 0;
      }
      batMesh.instanceMatrix.array.set(batBase);
      ledMesh.instanceMatrix.array.set(ledBase);
      batMesh.instanceMatrix.needsUpdate = true;
      ledMesh.instanceMatrix.needsUpdate = true;
      for (const b of batteries) b.active = true;
      if (spawns.slingshot) {
        slingState.active = true;
        slingPick.visible = true;
      }
      const p = ctx.player;
      if (p?.viewModel) {
        p.viewModel.drawing = false;
        p.viewModel.charge = 0;
      }
    },
  };
  return items;
}
