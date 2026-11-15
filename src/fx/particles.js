// Ambient particles: flashlight-lit dust motes, ground fog sprites, fireflies, faint beam veil.
// All motion for dust/fireflies is computed in the vertex shader (zero per-frame allocation).
import * as THREE from 'three';

const DUST_MAX = 350;
const FOG_MAX = 40;
const FLY_MAX = 25;
const FOG_R = 35;

const COMMON = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec3 uLightPos;
  uniform vec3 uLightDir;
  uniform float uCosHalf;
  uniform float uRange;
  uniform float uLightI;
  uniform float uScale;
  uniform float uFogD;
  uniform float uGroundY;
  float coneLit(vec3 wp) {
    vec3 L = wp - uLightPos;
    float d = max(length(L), 0.001);
    float cosA = dot(L / d, uLightDir);
    float cone = smoothstep(uCosHalf, mix(uCosHalf, 1.0, 0.45), cosA);
    float fall = clamp(1.0 - d / uRange, 0.0, 1.0);
    return cone * fall * fall * smoothstep(0.3, 1.5, d) * uLightI;
  }
`;

export function createParticles(ctx) {
  const scene = ctx.scene;
  const camera = ctx.camera;

  // shared uniforms (same objects referenced by every material)
  const U = {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uLightPos: { value: new THREE.Vector3() },
    uLightDir: { value: new THREE.Vector3(0, 0, -1) },
    uCosHalf: { value: Math.cos(0.4) },
    uRange: { value: 32 },
    uLightI: { value: 0 },
    uScale: { value: 800 },
    uFogD: { value: 0.028 },
    uGroundY: { value: 0 },
  };

  const rnd = () => Math.random();

  // ---------------------------------------------------------------- dust
  const dustGeo = new THREE.BufferGeometry();
  {
    const seed = new Float32Array(DUST_MAX * 3);
    const r = new Float32Array(DUST_MAX);
    for (let i = 0; i < DUST_MAX; i++) {
      seed[i * 3] = rnd(); seed[i * 3 + 1] = rnd(); seed[i * 3 + 2] = rnd();
      r[i] = rnd();
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST_MAX * 3), 3));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    dustGeo.setAttribute('aRand', new THREE.BufferAttribute(r, 1));
  }
  const dustMat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: COMMON + /* glsl */ `
      attribute vec3 aSeed;
      attribute float aRand;
      varying float vA;
      void main() {
        vec3 sz = vec3(28.0, 8.0, 28.0);
        vec3 p = aSeed * sz
          + vec3(0.14, -0.03, 0.06) * uTime
          + 0.3 * vec3(sin(uTime * 0.4 + aRand * 40.0), sin(uTime * 0.33 + aRand * 17.0), cos(uTime * 0.37 + aRand * 29.0));
        vec3 rel = mod(p - uCenter + sz * 0.5, sz) - sz * 0.5;
        vec3 wp = uCenter + rel;
        float edge = 1.0 - smoothstep(0.7, 1.0, max(max(abs(rel.x) / 14.0, abs(rel.z) / 14.0), abs(rel.y) / 4.0));
        float tw = 0.55 + 0.45 * sin(uTime * (1.0 + aRand * 2.0) + aRand * 100.0);
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        float fogT = exp(-uFogD * uFogD * dot(mv.xyz, mv.xyz));
        vA = coneLit(wp) * edge * tw * fogT;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uScale * (0.02 + aRand * 0.025) / max(-mv.z, 0.1), 1.0, 7.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        if (vA < 0.003) discard;
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float a = 1.0 - smoothstep(0.0, 1.0, dot(q, q));
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * 1.3, a * vA * 1.4);
      }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 5;
  scene.add(dust);

  // ---------------------------------------------------------------- fireflies
  const flyGeo = new THREE.BufferGeometry();
  {
    const seed = new Float32Array(FLY_MAX * 3);
    const r = new Float32Array(FLY_MAX);
    for (let i = 0; i < FLY_MAX; i++) {
      seed[i * 3] = rnd(); seed[i * 3 + 1] = rnd(); seed[i * 3 + 2] = rnd();
      r[i] = rnd();
    }
    flyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLY_MAX * 3), 3));
    flyGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    flyGeo.setAttribute('aRand', new THREE.BufferAttribute(r, 1));
  }
  const flyMat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: COMMON + /* glsl */ `
      attribute vec3 aSeed;
      attribute float aRand;
      varying float vA;
      void main() {
        vec2 sz = vec2(44.0);
        float t = uTime;
        vec3 p;
        p.xz = aSeed.xz * sz
          + vec2(sin(t * 0.21 + aRand * 50.0) * 2.0 + sin(t * 0.53 + aRand * 13.0) * 0.8,
                 cos(t * 0.17 + aRand * 31.0) * 2.0 + cos(t * 0.47 + aRand * 7.0) * 0.8);
        vec2 rel = mod(p.xz - uCenter.xz + sz * 0.5, sz) - sz * 0.5;
        float y = uGroundY + 0.5 + aSeed.y * 3.0 + sin(t * 0.3 + aRand * 7.0) * 0.4;
        vec3 wp = vec3(uCenter.x + rel.x, y, uCenter.z + rel.y);
        float edge = 1.0 - smoothstep(0.7, 1.0, max(abs(rel.x), abs(rel.y)) / 22.0);
        float b = sin(t * (0.5 + aRand * 0.7) + aRand * 100.0) * 0.5 + 0.5;
        b = smoothstep(0.6, 0.95, b);
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        float fogT = exp(-uFogD * uFogD * dot(mv.xyz, mv.xyz) * 0.5);
        vA = b * edge * fogT;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uScale * 0.07 / max(-mv.z, 0.1), 2.0, 14.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        if (vA < 0.01) discard;
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float d = dot(q, q);
        float a = exp(-d * 4.5) * (1.0 - smoothstep(0.7, 1.0, d));
        gl_FragColor = vec4(vec3(0.55, 1.0, 0.3) * 2.2, a * vA);
      }`,
  });
  const flies = new THREE.Points(flyGeo, flyMat);
  flies.frustumCulled = false;
  flies.renderOrder = 6;
  scene.add(flies);

  // ---------------------------------------------------------------- ground fog sprites
  const fogGeo = new THREE.BufferGeometry();
  const fogPos = new Float32Array(FOG_MAX * 4 * 3);
  const fogCx = new Float32Array(FOG_MAX);
  const fogCz = new Float32Array(FOG_MAX);
  const fogVx = new Float32Array(FOG_MAX);
  const fogVz = new Float32Array(FOG_MAX);
  const fogH = new Float32Array(FOG_MAX);
  {
    const corner = new Float32Array(FOG_MAX * 4 * 2);
    const misc = new Float32Array(FOG_MAX * 4 * 3);
    const idx = new Uint16Array(FOG_MAX * 6);
    const cs = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let i = 0; i < FOG_MAX; i++) {
      fogCx[i] = (rnd() * 2 - 1) * FOG_R;
      fogCz[i] = (rnd() * 2 - 1) * FOG_R;
      const ang = rnd() * 6.283, sp = 0.15 + rnd() * 0.35;
      fogVx[i] = Math.cos(ang) * sp;
      fogVz[i] = Math.sin(ang) * sp;
      const w = 5 + rnd() * 5, h = 1.1 + rnd() * 0.9, s = rnd();
      fogH[i] = h * 0.45;
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        corner[v * 2] = cs[k * 2]; corner[v * 2 + 1] = cs[k * 2 + 1];
        misc[v * 3] = w; misc[v * 3 + 1] = h; misc[v * 3 + 2] = s;
      }
      const b = i * 4;
      idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
    }
    fogGeo.setAttribute('position', new THREE.BufferAttribute(fogPos, 3).setUsage(THREE.DynamicDrawUsage));
    fogGeo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    fogGeo.setAttribute('aMisc', new THREE.BufferAttribute(misc, 3));
    fogGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  const fogMat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: COMMON + /* glsl */ `
      attribute vec2 aCorner;
      attribute vec3 aMisc;
      varying vec2 vC;
      varying vec3 vW;
      varying float vK;
      void main() {
        vC = aCorner;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        right = normalize(vec3(right.x, 0.0, right.z) + vec3(0.0001));
        vec3 wp = position + right * aCorner.x * aMisc.x * 0.5 + vec3(0.0, aCorner.y * aMisc.y * 0.5, 0.0);
        vW = wp;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vec4 mc = viewMatrix * vec4(position, 1.0);
        float dist = length(mc.xyz);
        float fogT = exp(-uFogD * uFogD * dist * dist * 0.6);
        vK = fogT * smoothstep(1.5, 6.0, dist) * (0.7 + 0.3 * sin(uTime * 0.2 + aMisc.z * 30.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: COMMON + /* glsl */ `
      varying vec2 vC;
      varying vec3 vW;
      varying float vK;
      void main() {
        float r = length(vC);
        float a = (1.0 - smoothstep(0.0, 1.0, r));
        a *= a;
        float lit = coneLit(vW);
        vec3 col = mix(vec3(0.42, 0.52, 0.62), vec3(0.85, 0.9, 0.95), clamp(lit * 2.0, 0.0, 1.0));
        float alpha = a * vK * (0.014 + 0.07 * lit);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const fog = new THREE.Mesh(fogGeo, fogMat);
  fog.frustumCulled = false;
  fog.renderOrder = 4;
  scene.add(fog);

  // ---------------------------------------------------------------- beam veil (camera-parented)
  const veilMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 }, uTime: U.uTime },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uI;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        float a = 1.0 - smoothstep(0.25, 0.95, r);
        a = a * a * (0.7 + 0.3 * sin(uTime * 0.7));
        gl_FragColor = vec4(vec3(0.75, 0.82, 0.95), a * uI * 0.030);
      }`,
  });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), veilMat);
  veil.position.set(0, 0, -0.12);
  veil.scale.setScalar(0.12 * Math.tan(0.42) * 2.6);
  veil.frustumCulled = false;
  veil.renderOrder = 7;
  veil.visible = false;
  if (!camera.parent) scene.add(camera);
  camera.add(veil);

  // ---------------------------------------------------------------- state
  let quality = ctx.settings?.quality || 'medium';
  let maxI = 0.0001;
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector2();
  let smoothI = 0;
  let beamScale = 1;

  function setQuality(q) {
    quality = q;
    const half = q === 'low';
    dustGeo.setDrawRange(0, half ? DUST_MAX >> 1 : DUST_MAX);
    flyGeo.setDrawRange(0, half ? FLY_MAX >> 1 : FLY_MAX);
    fogGeo.setDrawRange(0, (half ? FOG_MAX >> 1 : FOG_MAX) * 6);
    fogCount = half ? FOG_MAX >> 1 : FOG_MAX;
  }
  let fogCount = FOG_MAX;
  setQuality(quality);

  function update(dt) {
    dt = Math.min(dt, 0.1);
    const player = ctx.player;
    const eye = player?.eye || camera.position;
    U.uTime.value += dt;
    U.uCenter.value.copy(eye);

    // ground height under the player (fireflies)
    const world = ctx.world;
    const gy = world?.heightAt ? world.heightAt(eye.x, eye.z) : eye.y - 1.7;
    U.uGroundY.value += (gy - U.uGroundY.value) * Math.min(1, dt * 4);

    // flashlight
    const fl = player?.flashlight;
    const light = fl?.light;
    let target = 0;
    if (fl && light && fl.on && light.visible !== false) {
      if (light.intensity > maxI) maxI = light.intensity;
      target = Math.min(1, light.intensity / maxI);
      light.getWorldPosition(U.uLightPos.value);
      if (player.forward) U.uLightDir.value.copy(player.forward);
      else camera.getWorldDirection(U.uLightDir.value);
      U.uCosHalf.value = Math.cos((fl.angle ?? 0.42) * 0.95);
      U.uRange.value = fl.range ?? 32;
    }
    // follow flicker quickly, but ease on/off a little
    smoothI += (target - smoothI) * Math.min(1, dt * (target > smoothI ? 30 : 18));
    U.uLightI.value = smoothI;

    // beam veil
    const batt = fl?.battery ?? 1;
    const vi = smoothI * Math.min(1, 0.3 + batt * 1.2);
    veilMat.uniforms.uI.value = vi;
    veil.visible = vi > 0.01;
    if (light && light.parent === camera) veil.position.set(light.position.x * 0.2, light.position.y * 0.2, -0.12);
    const ang = fl?.angle ?? 0.42;
    const sc = 0.12 * Math.tan(ang) * 2.6;
    if (Math.abs(sc - beamScale) > 1e-4) { beamScale = sc; veil.scale.setScalar(sc); }

    // point scale (px per metre at 1 m)
    if (ctx.renderer) {
      ctx.renderer.getDrawingBufferSize(tmpS);
      U.uScale.value = tmpS.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    }
    const sf = ctx.scene.fog;
    U.uFogD.value = sf && sf.density !== undefined ? sf.density : 0.028;

    // fog sprites (CPU, 40 quads max)
    const px = eye.x, pz = eye.z;
    for (let i = 0; i < fogCount; i++) {
      let x = fogCx[i] + fogVx[i] * dt;
      let z = fogCz[i] + fogVz[i] * dt;
      if (x - px > FOG_R) x -= FOG_R * 2; else if (x - px < -FOG_R) x += FOG_R * 2;
      if (z - pz > FOG_R) z -= FOG_R * 2; else if (z - pz < -FOG_R) z += FOG_R * 2;
      fogCx[i] = x; fogCz[i] = z;
      const y = (world?.heightAt ? world.heightAt(x, z) : gy) + fogH[i] + 0.15;
      const o = i * 12;
      for (let k = 0; k < 4; k++) {
        fogPos[o + k * 3] = x; fogPos[o + k * 3 + 1] = y; fogPos[o + k * 3 + 2] = z;
      }
    }
    fogGeo.attributes.position.needsUpdate = true;
  }

  function dispose() {
    for (const o of [dust, flies, fog]) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
    camera.remove(veil); veil.geometry.dispose(); veilMat.dispose();
  }

  return { update, setQuality, dispose };
}
