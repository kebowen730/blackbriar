// Hand-held flashlight: shadow-casting SpotLight on the camera + weak fill light.
import * as THREE from 'three';

const BASE_INTENSITY = 300; // candela (decay 2): trees at 15 m clearly lit, 30 m faint
const FILL_INTENSITY = 2.0; // decay 1, very short range
const DRAIN_SECONDS = 330; // 5.5 min at multiplier 1

function makeCookie() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const h = S / 2;
  // main falloff
  let grad = g.createRadialGradient(h, h, 0, h, h, h);
  grad.addColorStop(0.0, '#ffffff');
  grad.addColorStop(0.18, '#f2f2f2');
  grad.addColorStop(0.55, '#b8b8b8');
  grad.addColorStop(0.82, '#6c6c6c');
  grad.addColorStop(0.96, '#1c1c1c');
  grad.addColorStop(1.0, '#000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // hot spot
  grad = g.createRadialGradient(h, h, 0, h, h, h * 0.28);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // soft reflector rings
  g.lineWidth = 3;
  const rings = [0.34, 0.52, 0.71, 0.86];
  for (let i = 0; i < rings.length; i++) {
    g.strokeStyle = i % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.arc(h, h, rings[i] * h, 0, Math.PI * 2);
    g.stroke();
  }
  // dirt / smudges
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * h * 0.9;
    const x = h + Math.cos(a) * r;
    const y = h + Math.sin(a) * r;
    const rad = 3 + rnd() * 10;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(0,0,0,${0.12 + rnd() * 0.18})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // faint filament shadow
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(h - 2, h - 20, 4, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFlashlight(ctx, player) {
  const light = new THREE.SpotLight(0xfff0d8, BASE_INTENSITY, 42, 0.42, 0.5, 1.0);
  light.position.set(0.26, -0.24, -0.92);
  light.target.position.set(0, 0, -10);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = 0.3;
  light.shadow.camera.far = 34;
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.04;
  light.shadow.radius = 2;
  try {
    light.map = makeCookie();
  } catch (e) {
    /* no canvas available */
  }

  const fill = new THREE.PointLight(0xffe6c0, FILL_INTENSITY, 8, 1);
  fill.position.set(0, 0.05, 0);
  fill.castShadow = false;

  const cam = ctx.camera;
  cam.add(light);
  cam.add(light.target);
  cam.add(fill);
  if (ctx.scene && !cam.parent) ctx.scene.add(cam);

  const _d = new THREE.Vector3();
  let prevYaw = null;
  let prevPitch = 0;
  let lagX = 0;
  let lagY = 0;
  let flickT = 0;
  let flickMul = 1;
  let forceT = 0;
  let forceNext = 0;
  let curMul = 0; // smoothed output multiplier
  let pending = 0;

  const fl = {
    on: false,
    battery: 1,
    light,
    fill,
    range: 32,
    angle: 0.42,
    drainMultiplier: 1,
    multiplier: 0,

    toggle() {
      ctx.audio?.play('flashlight_click');
      if (fl.on) {
        fl.on = false;
      } else if (fl.battery > 0) {
        fl.on = true;
      }
    },

    reload() {
      const inv = player.inventory;
      if (inv.batteries <= 0 || fl.battery > 0.97) return false;
      inv.batteries--;
      fl.battery = 1;
      ctx.audio?.play('battery');
      return true;
    },

    forceFlicker(seconds = 1) {
      forceT = Math.max(forceT, seconds);
    },

    isIlluminating(point, radius = 0.6) {
      if (!fl.on || fl.battery <= 0 || curMul < 0.25) return false;
      _d.subVectors(point, player.eye);
      const dist = _d.length();
      if (dist > fl.range + radius) return false;
      if (dist > 0.01) {
        _d.multiplyScalar(1 / dist);
        const ang = Math.acos(Math.min(1, Math.max(-1, _d.dot(player.forward))));
        if (ang > fl.angle * 0.9 + Math.atan2(radius, dist)) return false;
        const w = ctx.world;
        if (w?.lineOfSight && !w.lineOfSight(player.eye, point)) return false;
      }
      return true;
    },

    reset() {
      fl.on = false;
      fl.battery = 1;
      fl.drainMultiplier = 1;
      forceT = 0;
      flickMul = 1;
      curMul = 0;
      lagX = lagY = 0;
      prevYaw = null;
      light.intensity = 0;
      fill.intensity = 0;
    },

    update(dt) {
      // hand-held lag
      if (prevYaw === null) {
        prevYaw = player.yaw;
        prevPitch = player.pitch;
      }
      let dy = player.yaw - prevYaw;
      if (dy > Math.PI) dy -= Math.PI * 2;
      else if (dy < -Math.PI) dy += Math.PI * 2;
      const dp = player.pitch - prevPitch;
      prevYaw = player.yaw;
      prevPitch = player.pitch;
      lagX += dy * 0.7;
      lagY -= dp * 0.7;
      const k = 1 - Math.exp(-dt * 7);
      lagX -= lagX * k;
      lagY -= lagY * k;
      lagX = Math.max(-0.22, Math.min(0.22, lagX));
      lagY = Math.max(-0.22, Math.min(0.22, lagY));
      light.target.position.set(lagX * 10 - 0.08, lagY * 10 + 0.1, -10);

      // battery
      if (fl.on && player.enabled && ctx.state !== 'paused') {
        fl.battery -= (dt / DRAIN_SECONDS) * fl.drainMultiplier;
        if (fl.battery <= 0) {
          fl.battery = 0;
          fl.on = false;
          ctx.audio?.play('flashlight_click', { volume: 0.7 });
        }
      }

      // flicker
      let target = 1;
      if (fl.on) {
        const b = fl.battery;
        const low = b < 0.15 ? 1 - b / 0.15 : 0;
        if (low > 0) {
          flickT -= dt;
          if (flickT <= 0) {
            flickT = 0.04 + Math.random() * 0.18;
            flickMul = Math.random() < low * 0.55 ? 0.05 + Math.random() * 0.4 : 1;
          }
          target = flickMul * (0.3 + 0.7 * (b / 0.15));
        } else {
          flickMul = 1;
        }
        if (forceT > 0) {
          forceT -= dt;
          forceNext -= dt;
          if (forceNext <= 0) {
            forceNext = 0.025 + Math.random() * 0.08;
            pending = Math.random() < 0.55 ? Math.random() * 0.12 : 1;
          }
          target = Math.min(target, pending);
        }
      } else {
        target = 0;
        forceT = Math.max(0, forceT - dt);
      }
      // fast smoothing (instant-ish for flicker, short ramp for toggle)
      const rate = target < curMul ? 60 : 40;
      curMul += (target - curMul) * Math.min(1, dt * rate);
      if (Math.abs(target - curMul) < 0.002) curMul = target;
      fl.multiplier = curMul;
      light.intensity = BASE_INTENSITY * curMul;
      fill.intensity = FILL_INTENSITY * curMul;
    },
  };
  light.intensity = 0;
  fill.intensity = 0;
  return fl;
}
