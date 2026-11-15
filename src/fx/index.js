// FX module: post-processing chain, fear/pulse/fade controls, jumpscare, ambient particles.
// Chain: RenderPass -> [UnrealBloom @high] -> final ShaderPass (look) -> OutputPass (tone map + sRGB).
// Scene is rendered LINEAR into a HalfFloat target; renderer.toneMapping / outputColorSpace are
// applied once by OutputPass, so nothing is double-encoded.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FinalShader } from './finalPass.js';
import { createParticles } from './particles.js';
import { createJumpscare } from './jumpscare.js';

const BASE_FOV = 72;

export function createFX(ctx) {
  const { renderer, scene, camera } = ctx;
  let quality = ctx.settings?.quality || 'medium';

  // shared state (jumpscare writes into it too)
  const S = { fade: 0, pulse: 0, red: 0 };
  let fear = 0, fearTarget = 0, time = 0;
  let fovTouched = false;
  let fadeAnim = null;

  // ---------------------------------------------------------------- composer
  let composer = null, finalPass = null, bloomPass = null;
  const sizeV = new THREE.Vector2();

  function samplesFor(q) { return q === 'high' ? 4 : q === 'medium' ? 2 : 0; }

  function buildComposer() {
    if (composer) { try { composer.dispose(); } catch (e) { /* ignore */ } }
    renderer.getSize(sizeV);
    const pr = renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(sizeV.x * pr));
    const h = Math.max(1, Math.floor(sizeV.y * pr));
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: samplesFor(quality) });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.setSize(sizeV.x, sizeV.y);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = null;
    if (quality === 'high') {
      bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.6, 0.85); // internally half res
      composer.addPass(bloomPass);
    }
    finalPass = new ShaderPass(FinalShader);
    finalPass.uniforms.res.value.set(sizeV.x, sizeV.y);
    composer.addPass(finalPass);
    composer.addPass(new OutputPass());
  }

  buildComposer();

  const particles = createParticles(ctx);
  const js = createJumpscare(ctx, S);
  particles.setQuality(quality);

  // ---------------------------------------------------------------- api
  function resize(w, h) {
    if (!composer) return;
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    finalPass?.uniforms.res.value.set(w, h);
  }

  function setQuality(q) {
    if (!q || q === quality) return;
    const rebuild = samplesFor(q) !== samplesFor(quality) || (q === 'high') !== (quality === 'high');
    quality = q;
    particles.setQuality(q);
    if (rebuild) buildComposer();
  }

  function setFear(v) { fearTarget = Math.min(1, Math.max(0, v || 0)); }

  function pulse(strength = 1) { S.pulse = Math.max(S.pulse, strength); }

  function fade(toAlpha, seconds = 0) {
    if (fadeAnim) { const r = fadeAnim.res; fadeAnim = null; r(); }
    return new Promise((res) => {
      if (!(seconds > 0)) { S.fade = toAlpha; res(); return; }
      fadeAnim = { from: S.fade, to: toAlpha, dur: seconds, t: 0, res };
    });
  }

  function jumpscare(creature, onDone) {
    if (fadeAnim) { const r = fadeAnim.res; fadeAnim = null; r(); }
    js.start(creature, onDone, BASE_FOV);
    fovTouched = true;
  }

  function reset() {
    js.reset();
    S.fade = 0; S.pulse = 0; S.red = 0;
    if (fadeAnim) { const r = fadeAnim.res; fadeAnim = null; r(); }
    fear = 0; fearTarget = 0;
    if (camera.fov !== BASE_FOV) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }
    fovTouched = false;
    // jumpscare leaves roll/lookat on the camera; hand orientation back to the player's yaw/pitch
    const p = ctx.player;
    if (p && typeof p.yaw === 'number' && typeof p.pitch === 'number') {
      camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
    } else {
      camera.rotation.z = 0;
    }
  }

  function render(dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    time += dt;

    // decays
    S.pulse *= Math.exp(-dt * 4.5);
    if (S.pulse < 0.003) S.pulse = 0;
    S.red *= Math.exp(-dt * 3.5);
    if (S.red < 0.003) S.red = 0;

    if (fadeAnim) {
      const a = fadeAnim;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      S.fade = a.from + (a.to - a.from) * (k * k * (3 - 2 * k));
      if (k >= 1) { fadeAnim = null; S.fade = a.to; a.res(); }
    }

    fear += (fearTarget - fear) * (1 - Math.exp(-dt * 3));

    const owning = js.step(dt);

    // camera FOV breathing (skipped while the jumpscare owns the camera)
    if (!owning) {
      if (fear > 0.5) {
        const amp = Math.min(1, (fear - 0.5) * 2) * 1.2;
        const f = BASE_FOV + amp * (0.65 * Math.sin(time * 1.3) + 0.35 * Math.sin(time * 5.2));
        if (Math.abs(f - camera.fov) > 0.002) { camera.fov = f; camera.updateProjectionMatrix(); }
        fovTouched = true;
      } else if (fovTouched) {
        if (camera.fov !== BASE_FOV) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }
        fovTouched = false;
      }
    }

    const u = finalPass.uniforms;
    u.time.value = time % 1000;
    u.fear.value = js.active ? 1 : fear;
    u.pulse.value = S.pulse;
    u.red.value = S.red;
    u.fade.value = S.fade;

    composer.render(dt);
  }

  function update(dt) {
    particles.update(dt);
  }

  // ---------------------------------------------------------------- events
  const onSettings = (p) => { if (p && p.quality) setQuality(p.quality); };
  ctx.bus?.on?.('ui:settings', onSettings);

  return {
    render, update, resize, setQuality, setFear, pulse, fade, jumpscare, reset,
    get quality() { return quality; },
    get fear() { return fear; },
    get fadeAmount() { return S.fade; },
    get jumpscareActive() { return js.active; },
    dispose() {
      ctx.bus?.off?.('ui:settings', onSettings);
      particles.dispose();
      try { composer.dispose(); } catch (e) { /* ignore */ }
    },
  };
}
