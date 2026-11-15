// Static circle colliders in a uniform hash grid: queries, collision resolution and line of sight.
const CELL = 6;
const ORG = -270;
const N = 90;

export function createSpatial(half, heightAt) {
  const cells = new Array(N * N).fill(null);
  const colliders = [];
  let stamp = 0;
  const ci = (v) => {
    const i = Math.floor((v - ORG) / CELL);
    return i < 0 ? 0 : i >= N ? N - 1 : i;
  };

  // y = ground height under the collider, h = height of the (cylinder) obstacle
  function add(x, z, r, y = 0, h = 3) {
    const c = { x, z, r, y, h, _q: 0 };
    colliders.push(c);
    const x0 = ci(x - r);
    const x1 = ci(x + r);
    const z0 = ci(z - r);
    const z1 = ci(z + r);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const k = iz * N + ix;
        (cells[k] || (cells[k] = [])).push(c);
      }
    }
    return c;
  }

  function near(x, z, radius) {
    const res = [];
    stamp++;
    const x0 = ci(x - radius);
    const x1 = ci(x + radius);
    const z0 = ci(z - radius);
    const z1 = ci(z + radius);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const cell = cells[iz * N + ix];
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const c = cell[i];
          if (c._q === stamp) continue;
          c._q = stamp;
          const dx = c.x - x;
          const dz = c.z - z;
          const rr = radius + c.r;
          if (dx * dx + dz * dz <= rr * rr) res.push(c);
        }
      }
    }
    return res;
  }

  // true if a circle (x,z,radius) overlaps any collider (no allocation)
  function blocked(x, z, radius) {
    stamp++;
    const x0 = ci(x - radius - 2);
    const x1 = ci(x + radius + 2);
    const z0 = ci(z - radius - 2);
    const z1 = ci(z + radius + 2);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const cell = cells[iz * N + ix];
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const c = cell[i];
          if (c._q === stamp) continue;
          c._q = stamp;
          const dx = c.x - x;
          const dz = c.z - z;
          const rr = radius + c.r;
          if (dx * dx + dz * dz < rr * rr) return true;
        }
      }
    }
    return false;
  }

  function resolve(pos, radius) {
    for (let it = 0; it < 3; it++) {
      stamp++;
      let moved = false;
      const x0 = ci(pos.x - radius - 2.5);
      const x1 = ci(pos.x + radius + 2.5);
      const z0 = ci(pos.z - radius - 2.5);
      const z1 = ci(pos.z + radius + 2.5);
      for (let iz = z0; iz <= z1; iz++) {
        for (let ix = x0; ix <= x1; ix++) {
          const cell = cells[iz * N + ix];
          if (!cell) continue;
          for (let i = 0; i < cell.length; i++) {
            const c = cell[i];
            if (c._q === stamp) continue;
            c._q = stamp;
            const dx = pos.x - c.x;
            const dz = pos.z - c.z;
            const min = c.r + radius;
            const d2 = dx * dx + dz * dz;
            if (d2 < min * min) {
              const d = Math.sqrt(d2);
              if (d < 1e-5) {
                pos.x += min;
              } else {
                const k = (min - d) / d;
                pos.x += dx * k;
                pos.z += dz * k;
              }
              moved = true;
            }
          }
        }
      }
      if (!moved) break;
    }
    const lim = half - 0.5;
    if (pos.x > lim) pos.x = lim;
    else if (pos.x < -lim) pos.x = -lim;
    if (pos.z > lim) pos.z = lim;
    else if (pos.z < -lim) pos.z = -lim;
  }

  function los(a, b) {
    const ax = a.x;
    const az = a.z;
    const dx = b.x - ax;
    const dz = b.z - az;
    const len = Math.sqrt(dx * dx + dz * dz);

    // terrain ridges: a few height samples along the segment
    if (len > 6) {
      const n = Math.min(10, Math.floor(len / 6));
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const ly = a.y + (b.y - a.y) * t;
        if (heightAt(ax + dx * t, az + dz * t) > ly + 0.3) return false;
      }
    }

    const len2 = dx * dx + dz * dz;
    let ix = ci(ax);
    let iz = ci(az);
    const ex = ci(b.x);
    const ez = ci(b.z);
    const sx = dx > 0 ? 1 : -1;
    const sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? CELL / Math.abs(dx) : Infinity;
    const tdz = dz !== 0 ? CELL / Math.abs(dz) : Infinity;
    let tmx = dx !== 0 ? ((dx > 0 ? ix + 1 : ix) * CELL + ORG - ax) / dx : Infinity;
    let tmz = dz !== 0 ? ((dz > 0 ? iz + 1 : iz) * CELL + ORG - az) / dz : Infinity;
    stamp++;
    for (let guard = 0; guard < 300; guard++) {
      const cell = cells[iz * N + ix];
      if (cell) {
        for (let i = 0; i < cell.length; i++) {
          const c = cell[i];
          if (c._q === stamp) continue;
          c._q = stamp;
          const fx = c.x - ax;
          const fz = c.z - az;
          const r2 = c.r * c.r;
          if (fx * fx + fz * fz < r2) continue; // start inside
          const gx = c.x - b.x;
          const gz = c.z - b.z;
          if (gx * gx + gz * gz < r2) continue; // end inside
          let t = len2 > 1e-9 ? (fx * dx + fz * dz) / len2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const px = dx * t - fx;
          const pz = dz * t - fz;
          if (px * px + pz * pz < r2) {
            const y = a.y + (b.y - a.y) * t;
            if (y <= c.y + c.h) return false;
          }
        }
      }
      if (ix === ex && iz === ez) break;
      if (tmx < tmz) {
        if (tmx > 1) break;
        ix += sx;
        tmx += tdx;
      } else {
        if (tmz > 1) break;
        iz += sz;
        tmz += tdz;
      }
      if (ix < 0 || ix >= N || iz < 0 || iz >= N) break;
    }
    return true;
  }

  return { colliders, add, near, blocked, resolve, los };
}
