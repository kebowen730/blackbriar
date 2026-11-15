// Creek ribbon + pond disc merged into one dark, slightly reflective mesh with scrolling normals.
import * as THREE from 'three';
import { EXT } from './terrain.js';

export function buildWater(root, T, tex) {
  const pos = [];
  const uv = [];
  const idx = [];

  // creek strip, one row per 3 m of z, constant height per row (matches carved channel)
  const zEnd = T.pond.z;
  const rows = [];
  for (let z = -EXT; z < zEnd; z += 3) rows.push(z);
  rows.push(zEnd);
  for (let i = 0; i < rows.length; i++) {
    const z = rows[i];
    const r = T.creekRow(z);
    pos.push(r.x - r.half, r.y, z, r.x + r.half, r.y, z);
    uv.push((r.x - r.half) / 5, z / 5, (r.x + r.half) / 5, z / 5);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  // pond ellipse fan
  const base = pos.length / 3;
  const P = T.pond;
  pos.push(P.x, P.y, P.z);
  uv.push(P.x / 5, P.z / 5);
  const SEG = 40;
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const x = P.x + Math.cos(a) * P.rx * 0.95;
    const z = P.z + Math.sin(a) * P.rz * 0.95;
    pos.push(x, P.y, z);
    uv.push(x / 5, z / 5);
  }
  for (let i = 0; i < SEG; i++) {
    const a = base + 1 + i;
    const b = base + 1 + ((i + 1) % SEG);
    idx.push(base, b, a);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  g.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a1a22,
    roughness: 0.1,
    metalness: 0.2,
    normalMap: tex.waterNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    emissive: 0x0b2c3c,
    emissiveIntensity: 0.12,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'water';
  root.add(mesh);

  return {
    mesh,
    update(t) {
      tex.waterNormal.offset.set(t * 0.011, t * 0.019);
      mat.emissiveIntensity = 0.11 + 0.045 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1.3);
    },
  };
}
