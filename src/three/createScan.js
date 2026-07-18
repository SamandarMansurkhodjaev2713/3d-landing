import * as THREE from "three";

// «Лидарный пинг»: тонкое кольцо периодически расходится по грунту от ровера и гаснет —
// читается как активное сканирование поверхности (ровер «жив», он чувствует грунт).
// Модель-независимо (геометрия относительно грунта, а не узлов GLB). Сдержанно, анти-слоп:
// один холодный акцент (в тон UI-цвету), редкий медленный импульс, низкая яркость.

const SCAN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SCAN_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform float uProgress;  // 0..1 — радиус кольца
  uniform float uIntensity; // общий гейн (0 во время интро)
  uniform vec3 uColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0; // 0 центр .. 1 край плоскости
    if (d > 1.0) discard;
    float ring = smoothstep(0.05, 0.0, abs(d - uProgress)); // тонкое кольцо на радиусе uProgress
    float fade = 1.0 - uProgress;             // тускнеет по мере расширения
    float edge = smoothstep(1.0, 0.82, d);    // мягко гасим у края плоскости
    float a = ring * fade * fade * edge * uIntensity;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function createScan({ groundY = -0.4, radius = 16, cycle = 5.5, color } = {}) {
  const uniforms = {
    uProgress: { value: 0 },
    uIntensity: { value: 0 },
    uColor: { value: color ? color.clone() : new THREE.Color(0xa9d7e5) }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SCAN_VERT,
    fragmentShader: SCAN_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = groundY + 0.05; // чуть над грунтом, чтобы не было z-fighting в плоской зоне
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;

  return {
    mesh,
    setIntensity(v) {
      uniforms.uIntensity.value = v;
    },
    update(elapsed) {
      // Один медленный импульс за cycle секунд (кольцо гаснет у края до перезапуска).
      uniforms.uProgress.value = (elapsed % cycle) / cycle;
    }
  };
}
