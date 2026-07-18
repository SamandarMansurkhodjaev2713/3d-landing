import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// Сдержанный кино-color-grade поверх тонмапнутого кадра (sRGB LDR): мягкий контраст,
// лёгкая десатурация к монохрому и холодный подвал теней. Без depth — безопасно с
// logarithmicDepthBuffer (в отличие от SSAO/DoF). Очень деликатно, чтобы не «крутить ручки».
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 0.09 },
    uSaturation: { value: 0.93 },
    uCoolShadows: { value: 0.02 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uCoolShadows;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // Мягкая S-кривая контраста.
      c = mix(c, smoothstep(0.0, 1.0, c), uContrast);
      // Лёгкая десатурация к яркости (монохромный колор-скрипт).
      c = mix(vec3(l), c, uSaturation);
      // Едва холодный подвал теней (киношная сепарация).
      c += uCoolShadows * (1.0 - l) * vec3(-0.25, 0.0, 0.6);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `
};

// Сдержанный bloom: тонкое свечение солнечного диска и подсвеченных кромок металла —
// «киношная» световая правда. Высокий threshold (0.85) -> блумит только near-white,
// тёмный реголит в блум НЕ попадает. OutputPass делает tone mapping + sRGB на экран,
// поэтому интро-рамп renderer.toneMappingExposure (0.2->1.0) продолжает работать.
//
// Только десктоп: mip-цепочка UnrealBloomPass — самый дорогой проход, на телефонах
// (прошлые жалобы на лаги) рендерим напрямую renderer.render.
export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.28,
    0.2,
    0.92
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass()); // tone mapping + sRGB
  const grade = new ShaderPass(GradeShader); // color-grade поверх LDR (последний -> на экран)
  composer.addPass(grade);

  return {
    composer,
    bloom,
    grade,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    }
  };
}
