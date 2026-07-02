import * as THREE from "three";

// Звёздное небо лунного полюса: мерцающие звёзды с параллаксом, полоса Млечного Пути,
// очень слабые туманности и далёкая Земля. Туман на небо не действует (fog:false),
// поэтому звёзды видны на чёрном космосе. Группа крутится медленным дрейфом + от курсора.

const STAR_VERT = `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTw;
  void main() {
    vColor = aColor;
    // Мерцание: у каждой звезды своя фаза и скорость.
    float tw = 0.55 + 0.45 * sin(uTime * (0.5 + aPhase * 1.7) + aPhase * 6.2831);
    vTw = tw;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.6, aSize * uPixelRatio * (360.0 / -mv.z)) * (0.7 + 0.3 * tw);
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAG = `
  varying vec3 vColor;
  varying float vTw;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    float glow = smoothstep(0.5, 0.18, d) * 0.5;
    float a = core * core + glow;
    gl_FragColor = vec4(vColor, clamp(a, 0.0, 1.0) * vTw);
  }
`;

export function createSky({ isMobile = false, pixelRatio = 1 } = {}) {
  const group = new THREE.Group();
  // Звёзды крутятся (дрейф/параллакс), купол неподвижен (его градиент строго вертикален).
  const starsGroup = new THREE.Group();
  group.add(starsGroup);
  group.add(makeSkyDome());
  const R = 110; // радиус небесной сферы

  const starCount = isMobile ? 2200 : 4500;
  const galaxyCount = isMobile ? 1400 : 3000;

  const uTime = { value: 0 };
  const uPixelRatio = { value: pixelRatio };

  const makeStarMat = () =>
    new THREE.ShaderMaterial({
      uniforms: { uTime, uPixelRatio },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      // NormalBlending: корректная альфа поверх прозрачного canvas (additive давал
      // почти невидимые звёзды на alpha-фоне). Точки выходят чёткими, как настоящие звёзды.
      blending: THREE.NormalBlending,
      fog: false
    });

  // --- Обычные звёзды: равномерно по сфере (с редкими яркими «героями») ---
  starsGroup.add(buildStars(starCount, R, makeStarMat(), { band: 0, sizeMin: 0.7, sizeMax: 3.8, bright: 1.28 }));

  // --- Млечный Путь: плотная полоса звёзд вдоль наклонной плоскости (ярче и плотнее) ---
  const galaxy = buildStars(galaxyCount, R, makeStarMat(), { band: 1, sizeMin: 0.4, sizeMax: 1.6, bright: 0.9 });
  galaxy.rotation.set(0.5, 0.3, 0.2);
  starsGroup.add(galaxy);

  // --- Туманности: пара огромных едва заметных пятен вдоль полосы ---
  const nebulaTex = makeNebulaTexture();
  [
    { pos: [-55, 18, -70], size: 100, col: 0x2a3550, op: 0.09 },
    { pos: [48, -10, -78], size: 120, col: 0x39304a, op: 0.08 },
    { pos: [-12, 40, -85], size: 132, col: 0x223044, op: 0.07 },
    { pos: [70, 26, -38], size: 92, col: 0x2e2740, op: 0.06 }
  ].forEach((n) => {
    const mat = new THREE.SpriteMaterial({
      map: nebulaTex,
      color: n.col,
      transparent: true,
      opacity: isMobile ? n.op * 0.7 : n.op,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });
    const spr = new THREE.Sprite(mat);
    spr.position.set(...n.pos);
    spr.scale.setScalar(n.size);
    starsGroup.add(spr);
  });

  // --- Далёкая Земля: маленький освещённый серп высоко в небе ---
  const earth = buildEarth(isMobile);
  starsGroup.add(earth);

  let driftX = 0;
  let driftY = 0;

  return {
    group,
    update(elapsed, mx = 0, my = 0, reducedMotion = false) {
      uTime.value = elapsed;
      // Параллакс от курсора + очень медленный собственный дрейф.
      const tx = mx * 0.06 + (reducedMotion ? 0 : elapsed * 0.0015);
      const ty = my * 0.04;
      driftX += (tx - driftX) * 0.04;
      driftY += (ty - driftY) * 0.04;
      starsGroup.rotation.y = driftX;
      starsGroup.rotation.x = driftY;
    }
  };
}

// Градиентный купол неба: у горизонта — цвет тумана грунта, кверху плавно темнеет
// до космоса. Грунт уходит в туман того же цвета → стык грунт↔небо бесшовный.
function makeSkyDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      // Трёхзонный градиент глубокого космоса: тёплый горизонт (= цвет тумана грунта,
      // бесшовный стык) -> глубокий сине-серый middle -> почти чёрный холодный зенит.
      uTop: { value: new THREE.Color(0x04050a) },
      uMid: { value: new THREE.Color(0x0a0c15) },
      uBottom: { value: new THREE.Color(0x1b1a22) }
    },
    vertexShader: `
      varying float vH;
      void main() {
        vH = position.y / 125.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBottom;
      varying float vH;
      void main() {
        float t1 = smoothstep(0.0, 0.30, vH);
        float t2 = smoothstep(0.16, 0.62, vH);
        vec3 col = mix(uBottom, uMid, t1);
        col = mix(col, uTop, t2);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(125, 32, 16), mat);
  dome.renderOrder = -10;
  return dome;
}

function buildStars(count, R, material, { band, sizeMin, sizeMax, bright }) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const cWhite = new THREE.Color(0xeaf2ff);
  const cBlue = new THREE.Color(0x9fc0ff);
  const cAmber = new THREE.Color(0xffd9a8);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // Псевдослучайные, но детерминированные направления (без Math.random в рантайме сцены).
    let u = frac(Math.sin(i * 12.9898) * 43758.5453);
    let v = frac(Math.sin(i * 78.233) * 12543.123);
    const theta = u * Math.PI * 2;
    let phi = Math.acos(2 * v - 1);

    // Полоса Млечного Пути: стягиваем phi к экватору плоскости (туже -> чётче полоса).
    if (band) phi = Math.PI / 2 + (phi - Math.PI / 2) * 0.14;

    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);

    positions[i * 3 + 0] = x * R;
    positions[i * 3 + 1] = y * R;
    positions[i * 3 + 2] = z * R;

    const t = frac(Math.sin(i * 3.17) * 9999.0);
    sizes[i] = (sizeMin + Math.pow(t, 3) * (sizeMax - sizeMin)) * 1.0;
    phases[i] = frac(Math.sin(i * 5.71) * 1234.5);

    const pick = frac(Math.sin(i * 1.37) * 555.5);
    if (pick > 0.92) tmp.copy(cAmber);
    else if (pick > 0.6) tmp.copy(cBlue);
    else tmp.copy(cWhite);
    tmp.multiplyScalar(bright);
    colors[i * 3 + 0] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

  const pts = new THREE.Points(geo, material);
  pts.frustumCulled = false;
  return pts;
}

function buildEarth(isMobile) {
  const g = new THREE.Group();
  const radius = isMobile ? 3.8 : 4.6;

  // Сфера освещается тем же солнцем → виден чёткий серп; ночная сторона не чёрная.
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 48),
    new THREE.MeshStandardMaterial({
      color: 0x2f5a86,
      roughness: 1,
      metalness: 0,
      emissive: 0x0a1626,
      emissiveIntensity: 0.32,
      fog: false
    })
  );
  g.add(earth);

  // Атмосферный ободок: чуть большая BackSide-сфера даёт тонкое свечение по лимбу.
  const atm = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.13, 48, 48),
    new THREE.MeshBasicMaterial({
      color: 0x6fb0ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    })
  );
  g.add(atm);

  // Высоко в небе, в стороне от солнца.
  g.position.set(60, 42, -66);
  return g;
}

function makeNebulaTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0.0, "rgba(255,255,255,0.9)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.25)");
  grd.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const frac = (n) => n - Math.floor(n);
