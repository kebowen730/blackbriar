// Night sky: gradient dome with moon disc + halo, and a cheap star point cloud. Follows the camera.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

export const MOON_DIR = new THREE.Vector3(-0.42, 0.52, -0.74).normalize();

export function buildSky(root, seed) {
  const group = new THREE.Group();
  group.name = 'sky';

  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uMoon: { value: MOON_DIR.clone() },
      uHorizon: { value: new THREE.Color(0x05070b) },
      uMid: { value: new THREE.Color(0x0a1220) },
      uZenith: { value: new THREE.Color(0x02040a) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      uniform vec3 uMoon; uniform vec3 uHorizon; uniform vec3 uMid; uniform vec3 uZenith;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uZenith, smoothstep(0.2, 0.9, h));
        if (d.y < 0.0) col = uHorizon;
        float m = dot(d, normalize(uMoon));
        float ang = acos(clamp(m, -1.0, 1.0));
        float disc = 1.0 - smoothstep(0.024, 0.0275, ang);
        float halo = exp(-ang * 11.0) * 0.38 + exp(-ang * 3.2) * 0.07;
        vec3 moonCol = vec3(0.82, 0.9, 1.0);
        // faint maria on the disc
        float mare = 0.84 + 0.16 * sin(d.x * 61.0 + 1.3) * sin(d.z * 47.0 + d.y * 39.0);
        col += moonCol * halo * step(0.0, d.y + 0.05);
        col = mix(col, moonCol * mare * 1.15, disc);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 14), domeMat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  // stars
  const rng = mulberry32(seed * 101 + 3);
  const n = 1100;
  const pos = new Float32Array(n * 3);
  const sz = new Float32Array(n);
  const br = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let x;
    let y;
    let z;
    let l;
    do {
      x = rng() * 2 - 1;
      y = rng();
      z = rng() * 2 - 1;
      l = Math.hypot(x, y, z);
    } while (l > 1 || l < 0.2 || y / l < 0.04);
    pos[i * 3] = (x / l) * 190;
    pos[i * 3 + 1] = (y / l) * 190;
    pos[i * 3 + 2] = (z / l) * 190;
    const r = rng();
    sz[i] = 1.1 + r * r * 1.8;
    br[i] = 0.25 + r * 0.75;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  sg.setAttribute('aBr', new THREE.BufferAttribute(br, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize; attribute float aBr; varying float vBr;
      void main(){
        vBr = aBr;
        gl_PointSize = aSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      varying float vBr;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.1, length(c));
        vec3 col = mix(vec3(0.7,0.8,1.0), vec3(1.0,0.95,0.85), vBr*vBr);
        gl_FragColor = vec4(col * vBr * 0.9, a);
      }`,
  });
  const stars = new THREE.Points(sg, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(stars);

  root.add(group);
  return {
    group,
    follow(camera) {
      if (camera) group.position.copy(camera.position);
    },
  };
}
