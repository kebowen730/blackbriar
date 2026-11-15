// Combined final pass: grain, vignette, chromatic aberration, desaturation + cold shadow tint,
// fear distortion, static bursts (pulse), red death flash, fade to black.
// Runs in LINEAR HDR space (composer targets are HalfFloat); OutputPass afterwards applies
// tone mapping + sRGB encoding, so nothing here converts colour spaces.
import * as THREE from 'three';

export const FinalShader = {
  name: 'BlackbriarFinal',
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    fear: { value: 0 },
    pulse: { value: 0 },
    red: { value: 0 },
    fade: { value: 0 },
    res: { value: new THREE.Vector2(1280, 720) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float fear;
    uniform float pulse;
    uniform float red;
    uniform float fade;
    uniform vec2 res;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float aspect = res.x / res.y;
      float d = length(c * vec2(aspect, 1.0));
      float tick = floor(time * 24.0);

      // radial fear wobble (very subtle breathing of the image)
      float beat = 0.5 + 0.5 * sin(time * 6.5);
      uv += c * (fear * 0.012 * (0.4 + 0.6 * beat) * d);

      // static bursts: horizontal tearing bands
      if (pulse > 0.02) {
        float row = floor(uv.y * 46.0);
        float h = hash12(vec2(row, tick));
        float band = step(1.0 - clamp(pulse, 0.0, 1.0) * 0.55, h);
        uv.x += band * (hash12(vec2(row + 17.0, tick)) - 0.5) * 0.12 * pulse;
      }

      // chromatic aberration growing to the edges
      float ca = 0.0012 + 0.0045 * d * d + fear * 0.004 * d + pulse * 0.006;
      vec2 off = c * ca * 2.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;

      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));

      // desaturate + cold blue-teal shadows
      col = mix(col, vec3(lum), 0.16 + 0.16 * fear);
      float shadow = 1.0 - smoothstep(0.0, 0.18, lum);
      col *= mix(vec3(1.0), vec3(0.86, 1.0, 1.1), shadow * 0.6);
      col += vec3(0.0004, 0.0016, 0.0026) * shadow;

      // film grain, stronger in darks
      vec2 gp = floor(vUv * res / 1.4);
      float n = hash12(gp + tick * 37.0) - 0.5;
      float n2 = hash12(gp * 1.7 + tick * 91.0 + 5.0) - 0.5;
      float grain = (n + n2) * 0.7;
      float gAmp = (0.0055 + 0.0075 * fear) * (1.0 - 0.55 * smoothstep(0.0, 0.5, lum));
      col += grain * gAmp;
      col *= 1.0 + grain * (0.10 + 0.10 * fear);

      // vignette (tightens with fear, faint heartbeat throb)
      float inner = 0.30 - fear * 0.12 - fear * 0.03 * beat;
      float vig = 1.0 - smoothstep(inner, 0.98, d);
      col *= mix(1.0, vig, 0.88);

      // static mix: white noise
      if (pulse > 0.02) {
        float w = hash12(gl_FragCoord.xy + tick * 13.0);
        col = mix(col, vec3(w * 0.55), clamp(pulse, 0.0, 1.0) * 0.5);
        col += pulse * 0.05;
      }

      // death flash
      col = col * (1.0 - red * 0.65 * vec3(0.0, 1.0, 1.0)) + vec3(0.55, 0.0, 0.0) * red;

      col *= 1.0 - clamp(fade, 0.0, 1.0);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};
