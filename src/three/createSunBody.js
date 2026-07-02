import * as THREE from "three";

// Видимое ТЕЛО источника света: яркий солнечный диск низко над кромкой кратера
// + очень сдержанное анаморфное горизонтальное гало («rake»). Это операторская
// правда — свет в сцене мотивирован, но раньше у источника не было тела.
//
// Реализация намеренно дешёвая и анти-слоп: один аддитивный билборд с depthTest
// (зубчатая кромка кратера и ровер его честно перекрывают). НЕ god-rays-проход,
// НЕ радужный JJ-flare, НЕ EffectComposer (его в проекте нет). Диск сидит точно
// на векторе DirectionalLight, поэтому свет и его источник не «разъезжаются».

const SUN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    // Диск (ядро добела) + мягкое гало.
    float core = smoothstep(0.085, 0.0, r);
    float halo = pow(smoothstep(0.5, 0.0, r), 2.4);
    // Анаморфный горизонтальный rake: координату сжимаем по Y -> длинная тонкая черта.
    vec2 a = p * vec2(1.0, 9.0);
    float rake = pow(smoothstep(0.5, 0.0, length(a)), 1.6);
    // Едва заметное «дыхание» воздуха (не мерцание-слоп).
    float breath = 0.92 + 0.08 * sin(uTime * 0.6);
    float i = core * 1.4 + halo * 0.55 * breath + rake * 0.5;
    vec3 col = mix(uColor, vec3(1.0), core * 0.85);
    gl_FragColor = vec4(col, clamp(i, 0.0, 1.0) * uIntensity);
  }
`;

export function createSunBody({ isMobile = false, sunPosition, color } = {}) {
  const DIST = 100; // ближе купола (125) и звёзд (R=110), но далеко за ровером
  const size = isMobile ? 30 : 38;

  const uniforms = {
    uColor: { value: color ? color.clone() : new THREE.Color(1.0, 0.86, 0.72) },
    uIntensity: { value: 0 },
    uTime: { value: 0 }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SUN_VERT,
    fragmentShader: SUN_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  const dir = sunPosition.clone().normalize();
  mesh.position.copy(dir.multiplyScalar(DIST));
  mesh.renderOrder = -4; // позади ровера (0); купол -10
  mesh.frustumCulled = false;

  return {
    mesh,
    // Яркость диска (0..1) — интро поднимает её синхронно с восходом солнца.
    setIntensity(v) {
      uniforms.uIntensity.value = v;
    },
    // Билборд к камере + дыхание гало.
    update(camera, elapsed) {
      uniforms.uTime.value = elapsed;
      mesh.quaternion.copy(camera.quaternion);
    }
  };
}
