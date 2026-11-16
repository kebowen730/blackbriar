// Landmarks built from merged primitives: campsite, cabin, tower, wrecked car, graveyard, well.
import * as THREE from 'three';
import { PartBuilder, T4 } from './geo.js';

const PI = Math.PI;

export function buildLandmarks(env) {
  const { root, T, S, tex, rng } = env;
  const L = T.layout;
  const group = new THREE.Group();
  group.name = 'landmarks';

  const propMat = new THREE.MeshLambertMaterial({ map: tex.grain, vertexColors: true, color: 0xffffff });
  const out = {
    landmarks: [],
    hiding: [],
    hints: { batteries: [], slingshot: null },
    spawn: null,
    spawnYaw: 0,
    lantern: null,
    lanternMesh: null,
  };

  function makeSite(cfg, yaw) {
    const gy = T.heightAt(cfg.x, cfg.z);
    const cs = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const s = {
      cfg,
      yaw,
      gy,
      pb: new PartBuilder(),
      w(lx, lz) {
        return [cfg.x + lx * cs + lz * sn, cfg.z - lx * sn + lz * cs];
      },
      v(lx, lz, dy = 0) {
        const [x, z] = s.w(lx, lz);
        return new THREE.Vector3(x, T.heightAt(x, z) + dy, z);
      },
      col(lx, lz, r, h = 3) {
        const [x, z] = s.w(lx, lz);
        S.add(x, z, r, T.heightAt(x, z), h);
      },
      chain(x0, z0, x1, z1, r = 0.3, h = 2.5, step = 0.5) {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(1, Math.ceil(len / step));
        for (let i = 0; i <= n; i++) s.col(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, r, h);
      },
      finish({ tiltX = 0, tiltZ = 0, k = 0.45 } = {}) {
        const geo = s.pb.build({ project: true, k });
        const mesh = new THREE.Mesh(geo, propMat);
        mesh.position.set(cfg.x, gy, cfg.z);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.set(tiltX, yaw, tiltZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
      },
    };
    return s;
  }

  const WOOD = 0x6a5440;
  const WOOD_D = 0x45362a;
  const STONE = 0x6e7173;
  const STONE_D = 0x4a4d4f;
  const METAL = 0x3b3f44;
  const RUST = 0x6a3d27;

  // ============ CAMPSITE ============
  {
    const s = makeSite(L.camp, 0.5);
    const pb = s.pb;
    // tent (prism along its length) + groundsheet + pegs
    pb.prism(2.3, 1.5, 2.6, { x: -3.7, y: 0.03, z: -0.6, ry: 0.25, color: 0x4d5c3a, jit: 0.25 });
    pb.prism(0.9, 1.0, 0.04, { x: -3.7, y: 0.03, z: 0.72, ry: 0.25, color: 0x14160f });
    pb.box(2.5, 0.04, 2.8, { x: -3.7, y: 0.02, z: -0.6, ry: 0.25, color: 0x2c3524 });
    for (const [px, pz] of [[-4.9, 0.6], [-2.5, 0.8], [-4.9, -1.9], [-2.5, -2.0]]) pb.cyl(0.015, 0.015, 0.3, 4, { x: px, y: 0.12, z: pz, rz: 0.4, color: WOOD_D });
    // dead fire ring
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * PI * 2;
      pb.box(0.3, 0.22, 0.24, { x: Math.cos(a) * 0.62, y: 0.11, z: Math.sin(a) * 0.62, ry: -a, color: STONE, jit: 0.4 });
    }
    pb.cyl(0.5, 0.5, 0.05, 10, { y: 0.03, color: 0x15130f });
    pb.between([-0.35, 0.1, -0.1], [0.3, 0.2, 0.25], 0.06, 0.05, { color: 0x15110d }, 5);
    pb.between([0.3, 0.09, -0.3], [-0.2, 0.18, 0.3], 0.055, 0.045, { color: 0x1a140f }, 5);
    pb.between([-0.1, 0.07, 0.35], [0.35, 0.1, -0.35], 0.05, 0.04, { color: 0x120e0b }, 5);
    // log seats + stump
    pb.cyl(0.22, 0.22, 2.0, 8, { x: 2.3, y: 0.22, z: 0.3, rx: PI / 2, color: 0x5b4836, jit: 0.2 });
    pb.cyl(0.2, 0.2, 1.6, 8, { x: -0.4, y: 0.2, z: 2.1, rz: PI / 2, ry: 0.15, color: 0x54412f, jit: 0.2 });
    pb.cyl(0.3, 0.34, 0.42, 9, { x: 1.4, y: 0.21, z: -2.2, color: 0x66523c, jit: 0.2 });
    // crate + lantern fittings
    pb.box(0.55, 0.42, 0.55, { x: -1.5, y: 0.21, z: 1.9, ry: 0.3, color: WOOD_D });
    pb.cyl(0.1, 0.1, 0.04, 8, { x: -1.5, y: 0.44, z: 1.9, color: 0x1c1c1c });
    pb.cone(0.11, 0.1, 8, { x: -1.5, y: 0.72, z: 1.9, color: 0x1c1c1c });
    // cooking pot, pack, bedroll
    pb.cyl(0.14, 0.12, 0.16, 8, { x: 0.9, y: 0.08, z: -0.5, color: METAL });
    pb.box(0.5, 0.55, 0.3, { x: -2.0, y: 0.28, z: -2.6, ry: 0.5, color: 0x3a3025, jit: 0.3 });
    pb.cyl(0.14, 0.14, 0.9, 8, { x: 3.4, y: 0.14, z: -1.3, rz: PI / 2, ry: 0.3, color: 0x4a4a3e });
    s.finish();
    // colliders
    s.col(-3.7, -0.1, 0.85, 1.4);
    s.col(-3.7, -1.2, 0.85, 1.4);
    s.col(0, 0, 0.7, 0.3);
    s.chain(2.3, -0.7, 2.3, 1.3, 0.24, 0.45, 0.45);
    s.col(1.4, -2.2, 0.32, 0.4);
    s.col(-1.5, 1.9, 0.36, 0.45);

    // lantern: emissive body + the ONE warm point light
    const lp = s.v(-1.5, 1.9, 0.58);
    const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.22, 8), new THREE.MeshBasicMaterial({ color: 0xffc27a }));
    lm.position.copy(lp);
    group.add(lm);
    const light = new THREE.PointLight(0xff9a48, 4.5, 13, 2);
    light.position.copy(lp).add(new THREE.Vector3(0, 0.12, 0));
    group.add(light);
    out.lantern = light;
    out.lanternMesh = lm;

    // spawn: south of the fire, looking at it
    const sp = s.v(0, 3.8);
    const fire = s.v(0, 0);
    out.spawn = sp;
    out.spawnYaw = Math.atan2(fire.x - sp.x, fire.z - sp.z);
    out.hints.slingshot = s.v(1.4, -1.0, 0.12);
    out.landmarks.push({ name: 'Campsite', pos: s.v(0, 0) });
  }

  // ============ ABANDONED CABIN ============
  {
    const s = makeSite(L.cabin, 0.35);
    const pb = s.pb;
    const H = 2.5;
    const t = 0.25;
    const wood = 0x62503d;
    pb.box(6, 0.14, 5, { y: 0.06, color: 0x4a3b2c, jit: 0.3 });
    pb.box(6.3, 0.3, 5.3, { y: -0.05, color: STONE_D });
    // walls (door on +z, window gap on +x, back -z)
    pb.box(6.25, H, t, { y: H / 2, z: -2.5, color: wood, jit: 0.2 });
    pb.box(t, H, 5, { x: -3, y: H / 2, color: wood, jit: 0.2 });
    pb.box(t, H, 1.9, { x: 3, y: H / 2, z: -1.55, color: wood, jit: 0.2 });
    pb.box(t, H, 1.9, { x: 3, y: H / 2, z: 1.55, color: wood, jit: 0.2 });
    pb.box(t, 0.9, 1.2, { x: 3, y: 0.45, color: wood });
    pb.box(t, 0.5, 1.2, { x: 3, y: H - 0.25, color: wood });
    pb.box(2.33, H, t, { x: -1.96, y: H / 2, z: 2.5, color: wood, jit: 0.2 });
    pb.box(2.33, H, t, { x: 1.96, y: H / 2, z: 2.5, color: wood, jit: 0.2 });
    pb.box(1.6, 0.45, t, { y: H - 0.225, z: 2.5, color: wood });
    // horizontal log lines for texture
    for (let i = 0; i < 4; i++) pb.box(6.4, 0.07, 0.3, { y: 0.4 + i * 0.6, z: -2.5, color: WOOD_D });
    // gable roof along z, with a collapsed hole on the +x slope
    const ang = 0.436;
    const roofC = 0x35302b;
    pb.box(3.25, 0.12, 5.95, { x: -1.45, y: 3.13, rz: ang, color: roofC, jit: 0.25 });
    pb.box(3.25, 0.12, 2.75, { x: 1.45, y: 3.13, z: -1.6, rz: -ang, color: roofC, jit: 0.25 });
    pb.box(3.25, 0.12, 1.7, { x: 1.45, y: 3.13, z: 2.1, rz: -ang, color: roofC, jit: 0.25 });
    pb.prism(6.0, 1.3, 0.22, { y: H, z: 2.5, color: wood });
    pb.prism(6.0, 1.3, 0.22, { y: H, z: -2.5, color: wood });
    pb.between([0.1, 3.8, -2.9], [0.1, 3.8, 2.9], 0.07, 0.07, { color: WOOD_D }, 5);
    // fallen roof beams + sagging
    pb.between([1.0, 2.9, -0.1], [2.8, 2.1, 0.9], 0.07, 0.06, { color: WOOD_D }, 5);
    // chimney
    pb.box(0.8, 3.9, 0.8, { x: -3.3, y: 1.95, z: -0.6, color: STONE, jit: 0.35 });
    pb.box(0.95, 0.2, 0.95, { x: -3.3, y: 3.95, z: -0.6, color: STONE_D });
    // door step + door leaning
    pb.box(1.8, 0.14, 0.6, { y: 0.07, z: 2.95, color: STONE_D });
    pb.box(0.8, 1.9, 0.06, { x: 1.4, y: 0.95, z: 3.4, rx: -0.5, color: WOOD_D });
    // interior
    pb.box(1.0, 0.3, 2.0, { x: -2.2, y: 0.3, z: -1.2, color: WOOD_D });
    pb.box(0.9, 0.08, 1.9, { x: -2.2, y: 0.5, z: -1.2, color: 0x3d3730 });
    pb.box(1.1, 0.08, 0.7, { x: 1.6, y: 0.75, z: -1.9, color: WOOD_D });
    for (const [lx, lz] of [[1.1, -2.2], [2.1, -2.2], [1.1, -1.6], [2.1, -1.6]]) pb.box(0.07, 0.72, 0.07, { x: lx, y: 0.36, z: lz, color: WOOD_D });
    pb.box(0.4, 0.04, 0.4, { x: 0.6, y: 0.16, z: 0.8, rz: 1.3, color: WOOD_D });
    pb.cyl(0.3, 0.3, 0.7, 9, { x: 2.3, y: 0.35, z: -0.4 + 0.3, color: 0x4d3b2a });
    pb.box(0.9, 1.6, 0.3, { x: 2.5, y: 0.8, z: 0.0, color: WOOD_D }); // shelf
    s.finish();
    // wall collider chains (door gap x in [-0.8,0.8], window sill h 0.9)
    s.chain(-3.1, -2.5, 3.1, -2.5, 0.3, H);
    s.chain(-3, -2.5, -3, 2.5, 0.3, H);
    s.chain(3, -2.5, 3, -0.7, 0.3, H);
    s.chain(3, 0.7, 3, 2.5, 0.3, H);
    s.chain(3, -0.55, 3, 0.55, 0.3, 0.9);
    s.chain(-3.1, 2.5, -1.1, 2.5, 0.3, H);
    s.chain(1.1, 2.5, 3.1, 2.5, 0.3, H);
    s.col(-3.3, -0.6, 0.55, 4);
    const c = s.v(0, 0.2);
    out.hiding.push({ id: 'cabin', type: 'cabin', pos: c, r: 2.1 });
    out.hints.batteries.push(s.v(1.9, -1.5, 0.9));
    out.landmarks.push({ name: 'Abandoned Cabin', pos: s.v(0, 0) });
  }

  // ============ RANGER TOWER ============
  {
    const s = makeSite(L.tower, 0.8);
    const pb = s.pb;
    const wood = 0x5d4a38;
    const corner = (sx, sz, y) => {
      const k = 1.7 - 0.5 * (y / 8);
      return [sx * k, y, sz * k];
    };
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pb.between(corner(sx, sz, -0.3), corner(sx, sz, 8.2), 0.17, 0.13, { color: wood, jit: 0.2 }, 6);
    // beams + X braces on four faces, two levels
    const faces = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]];
    for (const [a, b] of faces) {
      for (const [y0, y1] of [[0.2, 4], [4, 8]]) {
        pb.between(corner(a[0], a[1], y0), corner(b[0], b[1], y1), 0.045, 0.045, { color: WOOD_D }, 4);
        pb.between(corner(b[0], b[1], y0), corner(a[0], a[1], y1), 0.045, 0.045, { color: WOOD_D }, 4);
      }
      pb.between(corner(a[0], a[1], 4), corner(b[0], b[1], 4), 0.06, 0.06, { color: WOOD_D }, 4);
      pb.between(corner(a[0], a[1], 7.9), corner(b[0], b[1], 7.9), 0.07, 0.07, { color: WOOD_D }, 4);
    }
    // platform + railings
    pb.box(3.7, 0.2, 3.7, { y: 8.1, color: 0x4f3f30, jit: 0.3 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pb.box(0.08, 1.0, 0.08, { x: sx * 1.75, y: 8.7, z: sz * 1.75, color: wood });
    pb.box(3.6, 0.07, 0.07, { y: 9.15, z: -1.75, color: wood });
    pb.box(3.6, 0.07, 0.07, { y: 9.15, z: 1.75, color: wood });
    pb.box(0.07, 0.07, 3.6, { x: -1.75, y: 9.15, color: wood });
    pb.box(0.07, 0.07, 1.4, { x: 1.75, y: 9.15, z: -1.0, color: wood });
    // lookout hut
    const hy = 8.2;
    pb.box(2.5, 1.9, 0.12, { y: hy + 0.95, z: -1.2, color: wood });
    pb.box(0.12, 1.9, 2.5, { x: -1.2, y: hy + 0.95, color: wood });
    pb.box(0.12, 0.7, 2.5, { x: 1.2, y: hy + 0.35, color: wood });
    pb.box(0.12, 0.4, 2.5, { x: 1.2, y: hy + 1.7, color: wood });
    pb.box(0.8, 1.9, 0.12, { x: -0.85, y: hy + 0.95, z: 1.2, color: wood });
    pb.box(0.8, 1.9, 0.12, { x: 0.85, y: hy + 0.95, z: 1.2, color: wood });
    pb.cone(2.1, 1.0, 4, { y: hy + 2.4, ry: PI / 4, color: 0x2e2a26 });
    pb.box(0.5, 0.06, 0.4, { x: 0.3, y: hy + 0.95, z: -0.6, color: WOOD_D });
    // ladder on +z face
    const lad = (x, y) => {
      const k = 1.7 - 0.5 * (y / 8) + 0.18;
      return [x, y, k];
    };
    pb.between(lad(-0.32, 0), lad(-0.32, 8.1), 0.045, 0.045, { color: wood }, 4);
    pb.between(lad(0.32, 0), lad(0.32, 8.1), 0.045, 0.045, { color: wood }, 4);
    for (let i = 1; i < 21; i++) {
      const y = (i / 21) * 8.1;
      pb.box(0.64, 0.04, 0.05, { x: 0, y, z: 1.7 - 0.5 * (y / 8) + 0.18, color: WOOD_D });
    }
    s.finish();
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) s.col(sx * 1.7, sz * 1.7, 0.36, 9);
    out.hints.batteries.push(s.v(0.4, 2.8, 0.1));
    out.landmarks.push({ name: 'Ranger Tower', pos: s.v(0, 0) });
  }

  // ============ WRECKED CAR ============
  {
    const s = makeSite(L.car, -0.6);
    const pb = s.pb;
    const body = 0x5e3a2a;
    pb.box(4.3, 0.55, 1.8, { y: 0.62, color: body, jit: 0.35 });
    pb.box(2.0, 0.7, 1.65, { x: -0.45, y: 1.2, color: body, jit: 0.3 });
    pb.box(1.62, 0.38, 1.7, { x: -0.45, y: 1.25, color: 0x0a0d0f });
    pb.box(2.15, 0.1, 1.75, { x: -0.45, y: 1.6, color: RUST, jit: 0.35 });
    for (const [px, pz] of [[0.52, 0.8], [0.52, -0.8], [-1.42, 0.8], [-1.42, -0.8]]) pb.box(0.1, 0.4, 0.1, { x: px, y: 1.24, z: pz, color: body });
    // open hood
    pb.box(1.3, 0.1, 1.7, { x: 1.17, y: 1.49, rz: 1.05, color: body, jit: 0.4 });
    pb.box(0.7, 0.3, 1.0, { x: 1.5, y: 0.98, color: 0x1a1816 }); // engine
    // bumpers + grille
    pb.box(0.14, 0.18, 1.9, { x: 2.2, y: 0.5, color: METAL });
    pb.box(0.14, 0.18, 1.9, { x: -2.2, y: 0.5, color: METAL, rz: 0.2 });
    // wheels (one missing, lying on the ground)
    for (const [px, pz] of [[1.35, 0.95], [-1.4, 0.95], [-1.4, -0.95]]) pb.cyl(0.34, 0.34, 0.26, 10, { x: px, y: 0.34, z: pz, rx: PI / 2, color: 0x0e0e0e });
    pb.cyl(0.34, 0.34, 0.26, 10, { x: 2.7, y: 0.14, z: -1.8, rz: 0.1, color: 0x0e0e0e });
    // door hanging open
    pb.box(1.1, 0.6, 0.06, { x: -0.2, y: 1.05, z: 1.4, ry: -0.9, color: body, jit: 0.3 });
    // moss/vines
    pb.sphere(0.8, { x: -0.5, y: 1.6, z: 0.1, sy: 0.15, sx: 1.4, color: 0x2a3a22, jit: 0.4 });
    s.finish({ tiltX: 0.09 });
    for (const x of [-1.5, 0, 1.5]) s.col(x, 0, 1.0, 1.8);
    out.hints.batteries.push(s.v(0.3, 2.4, 0.1));
    out.landmarks.push({ name: 'Wrecked Car', pos: s.v(0, 0) });
  }

  // ============ GRAVEYARD ============
  {
    const s = makeSite(L.grave, -0.2);
    const pb = s.pb;
    const gr = (a, b) => a + (b - a) * rng();
    let hs = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        const x = -6 + col * 3 + gr(-0.5, 0.5);
        const z = -4 + row * 4 + gr(-0.5, 0.5);
        if (rng() < 0.12) continue;
        const kind = rng();
        const tx = gr(-0.16, 0.16);
        const tz = gr(-0.22, 0.22);
        const yaw = gr(-0.25, 0.25);
        if (kind < 0.22) {
          pb.within(T4(x, 0, z, tx, yaw, tz), () => {
            pb.box(0.12, 1.5, 0.12, { y: 0.7, color: WOOD, jit: 0.3 });
            pb.box(0.8, 0.12, 0.12, { y: 1.05, color: WOOD, jit: 0.3 });
          });
          s.col(x, z, 0.25, 1.5);
        } else {
          const c = kind < 0.6 ? STONE : STONE_D;
          pb.within(T4(x, 0, z, tx, yaw, tz), () => {
            pb.box(0.72, 1.0, 0.16, { y: 0.45, color: c, jit: 0.35 });
            pb.cyl(0.36, 0.36, 0.16, 8, { y: 0.95, rx: PI / 2, color: c, jit: 0.35 });
          });
          s.col(x, z, 0.38, 1.1);
        }
        pb.sphere(1, { x, y: 0, z: z + 1.0, sx: 0.55, sy: 0.14, sz: 1.0, color: 0x29271e, jit: 0.4 });
        hs++;
      }
    }
    // a taller monument
    pb.box(1.2, 0.5, 1.2, { x: 0, y: 0.25, z: 6.5, color: STONE_D, jit: 0.3 });
    pb.box(0.7, 2.2, 0.7, { x: 0, y: 1.6, z: 6.5, color: STONE, jit: 0.3, rz: 0.05 });
    pb.box(0.8, 0.2, 0.8, { x: 0, y: 2.8, z: 6.5, color: STONE_D });
    s.col(0, 6.5, 0.7, 3);
    // iron fence fragment
    const fz = -8.5;
    for (let i = 0; i <= 9; i++) {
      const x = -7 + i * 1.0;
      if (i === 4 || i === 5) continue;
      const lean = i === 7 ? 0.5 : 0;
      pb.within(T4(x, 0, fz, 0, 0, lean), () => {
        pb.box(0.07, 1.35, 0.07, { y: 0.67, color: METAL });
        pb.cone(0.07, 0.22, 4, { y: 1.46, color: METAL });
      });
      if (i < 9 && i !== 3 && i !== 6) {
        pb.box(1.0, 0.05, 0.05, { x: x + 0.5, y: 0.32, z: fz, color: METAL });
        pb.box(1.0, 0.05, 0.05, { x: x + 0.5, y: 1.05, z: fz, rz: i === 7 ? 0.3 : 0, color: METAL });
      }
      if (i !== 7) s.col(x, fz, 0.14, 1.35);
    }
    // railed spans block the player (r 0.35) and creatures; x in (-4, -1) stays open as the gap
    s.chain(-7, fz, -4, fz, 0.2, 1.35, 0.4);
    s.chain(0, fz, 2, fz, 0.2, 1.35, 0.4);
    pb.box(0.06, 0.06, 1.0, { x: -3.6, y: 0.03, z: fz + 0.5, rx: 0.1, color: METAL }); // fallen rail
    // gate pillars
    for (const x of [-8, 3]) {
      pb.box(0.5, 2.0, 0.5, { x, y: 1.0, z: fz, color: STONE_D, jit: 0.3 });
      pb.box(0.6, 0.15, 0.6, { x, y: 2.05, z: fz, color: STONE });
      s.col(x, fz, 0.32, 2.1);
    }
    s.finish();
    out.hints.batteries.push(s.v(-2, -6.5, 0.1));
    out.landmarks.push({ name: 'Graveyard', pos: s.v(0, 0) });
  }

  // ============ OLD WELL ============
  {
    const s = makeSite(L.well, 0.9);
    const pb = s.pb;
    for (let layer = 0; layer < 3; layer++) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = ((i + layer * 0.5) / n) * PI * 2;
        pb.box(0.55, 0.36, 0.34, { x: Math.cos(a) * 1.0, y: 0.18 + layer * 0.36, z: Math.sin(a) * 1.0, ry: -a + PI / 2, color: layer === 1 ? STONE_D : STONE, jit: 0.4 });
      }
    }
    pb.cyl(0.85, 0.85, 0.02, 12, { y: 0.35, color: 0x050606 });
    pb.box(0.14, 2.7, 0.14, { x: -1.25, y: 1.35, color: WOOD });
    pb.box(0.14, 2.7, 0.14, { x: 1.25, y: 1.35, color: WOOD });
    pb.cyl(0.07, 0.07, 2.7, 6, { y: 2.45, rz: PI / 2, color: WOOD_D });
    pb.box(0.06, 0.06, 0.9, { x: 0.95, y: 2.4, z: 0, rx: 0, color: WOOD_D });
    pb.cyl(0.015, 0.015, 1.7, 4, { x: 0, y: 1.55, z: 0.05, color: 0x2a251f });
    pb.cyl(0.14, 0.11, 0.2, 8, { x: 0.1, y: 0.62, z: 0.05, color: WOOD_D });
    pb.box(1.5, 0.1, 1.6, { x: -0.7, y: 2.9, color: 0x2f2a26, rz: 0.45 });
    pb.box(1.5, 0.1, 1.6, { x: 0.7, y: 2.9, color: 0x2f2a26, rz: -0.45 });
    pb.prism(2.6, 0.7, 0.1, { y: 2.55, z: 0.8, color: WOOD_D });
    pb.prism(2.6, 0.7, 0.1, { y: 2.55, z: -0.8, color: WOOD_D });
    s.finish();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      s.col(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.36, 1.1);
    }
    s.col(-1.25, 0, 0.16, 2.8);
    s.col(1.25, 0, 0.16, 2.8);
    out.hints.batteries.push(s.v(1.2, 2.2, 0.1));
    out.landmarks.push({ name: 'Old Well', pos: s.v(0, 0) });
  }

  root.add(group);
  return out;
}
