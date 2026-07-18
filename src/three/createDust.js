import * as THREE from "three";

// Низкосолнечные пылинки реголита: редкие, медленные частицы у грунта возле ровера,
// которые ловят только скользящий свет (forward-scatter к солнцу). Дают кадру глубину
// и «дыхание» без тумана и без объёмного прохода. Переиспользует паттерн star-шейдера.
//
// Анти-слоп: держим ОЧЕНЬ редко и медленно — иначе читается как снег/туман. На
// безвоздушной Луне взвеси нет, это осознанная кинематографическая вольность.

const DUST_VERT = `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uSunDirW;     // направление НА солнце (мир)
  uniform float uIntensity;  // общий гейн (поднимается в интро вместе с солнцем)
  varying float vA;
  void main() {
    vec3 p = position;
    // В вакууме пыль не висит: короткий выброс идёт по баллистической дуге и падает.
    float flight = fract(uTime * 0.12 + aPhase);
    float arc = 4.0 * flight * (1.0 - flight);
    float spread = flight * flight;
    p.x += (aPhase - 0.5) * spread * 2.4;
    p.y += arc * (0.28 + aPhase * 0.75);
    p.z += (fract(aPhase * 7.13) - 0.5) * spread * 2.0;

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec3 toCam = normalize(cameraPosition - world.xyz);
    // Forward-scatter: пылинка вспыхивает, когда смотрим СКВОЗЬ неё на солнце.
    float fs = pow(max(-dot(toCam, uSunDirW), 0.0), 3.0);
    float life = smoothstep(0.0, 0.08, flight) * (1.0 - smoothstep(0.68, 1.0, flight));
    vA = (0.12 + 0.88 * fs) * life * uIntensity;

    vec4 mv = viewMatrix * world;
    gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const DUST_FRAG = `
  precision mediump float;
  varying float vA;
  uniform vec3 uColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, a * a * clamp(vA, 0.0, 1.0));
  }
`;

const frac = (n) => n - Math.floor(n);

export function createDust({ isMobile = false, pixelRatio = 1, sunDir, count, area = 15, groundY = -0.4 } = {}) {
  const n = count != null ? count : isMobile ? 28 : 72;
  const positions = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const phases = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    // Детерминированное распределение в низком объёме вокруг ровера.
    const ux = frac(Math.sin(i * 12.9898) * 43758.5453);
    const uz = frac(Math.sin(i * 78.233) * 12543.123);
    const uy = frac(Math.sin(i * 3.17) * 9999.0);
    positions[i * 3 + 0] = (ux * 2 - 1) * area;
    positions[i * 3 + 1] = groundY + 0.03 + uy * 0.18;
    positions[i * 3 + 2] = (uz * 2 - 1) * area;
    sizes[i] = 0.7 + frac(Math.sin(i * 5.71) * 1234.5) * 1.6;
    phases[i] = frac(Math.sin(i * 1.37) * 555.5);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uSunDirW: { value: sunDir ? sunDir.clone().normalize() : new THREE.Vector3(-10, 0.24, 2.5).normalize() },
    uIntensity: { value: 0 },
    uColor: { value: new THREE.Color(0.76, 0.74, 0.69) }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    transparent: true,
    depthWrite: false,
    // NormalBlending — как у звёзд (additive почти невидим на alpha-фоне неба).
    blending: THREE.NormalBlending,
    fog: false
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 1;

  return {
    points,
    setIntensity(v) {
      uniforms.uIntensity.value = v;
    },
    update(elapsed) {
      uniforms.uTime.value = elapsed;
    }
  };
}
