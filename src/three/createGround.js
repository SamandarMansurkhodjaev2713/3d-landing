import * as THREE from "three";

// Лунное окружение: рельефный грунт реголита (A) с микрофактурой (B) и валунами (C),
// далёкий зубчатый край кратера Шеклтон + контактная тень. Под ровером поверхность
// плоская (чтобы он стоял ровно), дальше — холмы и кратеры, уходящие в дымку-горизонт.

// --- Детерминированный 2D value-noise (без Math.random в сцене) ---
const frac = (n) => n - Math.floor(n);
function hash(x, y) {
  return frac(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, y) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; }
  return s;
}
const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Направление ключевого света. ОБЯЗАНО совпадать с DirectionalLight в createLights.js
// (источник статичен — панель сцены не меняет его положение). Нужен для направленной
// контактной тени и для грейзинг-блеска реголита по линии терминатора.
const SUN_POS = new THREE.Vector3(-8.0, 1.7, 3.2);

// Загрузчик PBR-текстур (CC0, Poly Haven: moon_meteor_01 — реальный лунный реголит).
const _texLoader = new THREE.TextureLoader();
function loadTex(url, { srgb = false, repeat = 1 } = {}) {
  const t = _texLoader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8; // как у текстур ровера — низкое солнце под острым углом иначе мерцает
  return t;
}

// Несколько кратеров с приподнятым валом.
const CRATERS = [
  { x: 44, y: -34, r: 15, depth: 2.4 },
  { x: -58, y: 26, r: 22, depth: 3.2 },
  { x: 24, y: 64, r: 11, depth: 1.6 },
  { x: -30, y: -62, r: 18, depth: 2.6 }
];
function craterProfile(d, r, depth) {
  if (d > r * 1.45) return 0;
  const t = d / r;
  if (t < 1) return depth * (1 - t * t); // чаша (вычитается -> впадина)
  return -depth * 0.32 * (1 - (t - 1) / 0.45); // вал (поднимает край)
}

// Высота грунта в локальных координатах плоскости (lx, lz).
function terrainHeight(lx, lz) {
  const r = Math.sqrt(lx * lx + lz * lz);
  const flat = smooth(7, 20, r); // плоско под ровером, рельеф дальше
  let h = (fbm(lx * 0.012, lz * 0.012) - 0.5) * 3.0; // крупные холмы
  h += (fbm(lx * 0.05, lz * 0.05) - 0.5) * 0.8; // средняя рябь
  for (const c of CRATERS) h -= craterProfile(Math.hypot(lx - c.x, lz - c.y), c.r, c.depth);
  return h * flat;
}

export function createGround(scene, y, radius) {
  const mobile = window.innerWidth <= 768;

  // --- A. Рельефная поверхность ---
  const seg = mobile ? 120 : 180;
  const geo = new THREE.PlaneGeometry(400, 400, seg, seg);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, terrainHeight(pos.getX(i), pos.getY(i)));
  }
  geo.computeVertexNormals();

  // --- B. PBR-реголит из реальных фотограмметрических карт (Poly Haven moon_meteor_01) ---
  const res = mobile ? "1k" : "2k";
  const R = mobile ? 48 : 78; // тайлинг по плоскости 400×400 — мельче зерно у ровера
  const gp = `${import.meta.env.BASE_URL}assets/textures/ground/`;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    map: loadTex(`${gp}albedo_${res}.jpg`, { srgb: true, repeat: R }),
    normalMap: loadTex(`${gp}normal_${res}.jpg`, { repeat: R }),
    roughnessMap: loadTex(`${gp}rough_${res}.jpg`, { repeat: R }),
    aoMap: loadTex(`${gp}ao_${res}.jpg`, { repeat: R }) // затемнение в микро-углублениях
  });
  mat.aoMapIntensity = 1.1;
  mat.normalScale = new THREE.Vector2(1.9, 1.9); // выраженный микрорельеф под скользящим солнцем

  // Грейзинг-блеск реголита по терминатору (тёплый forward-scatter, view-независимый)
  // + макро-вариация яркости, которая убивает видимую сетку тайлинга. Без новых проходов.
  applyGroundShader(mat, 2.5 / R);

  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = y;
  ground.renderOrder = -2;
  ground.receiveShadow = true; // принимает реальную тень ровера (десктоп)
  scene.add(ground);

  // --- Далёкий край кратера ---
  const rim = createCraterRim(y);
  scene.add(rim);

  // --- C. Разбросанные валуны ---
  const rocks = createRocks(y, mobile);
  scene.add(rocks);

  // --- Контактный AO под шасси ---
  // Реальную отброшенную тень теперь даёт shadow map (десктоп), поэтому фейковую
  // «cast»-плоскость убрали. Оставляем только тугую AO-впадину в стыке шасси с грунтом
  // (контактное затемнение, которое одна жёсткая направленная тень не воспроизводит).
  // На мобайле теней нет — там эта впадина работает и за лёгкую «посадку» аппарата.
  const ao = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 1.7, radius * 1.2),
    new THREE.MeshBasicMaterial({
      map: makeShadowTexture(0.9),
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    })
  );
  ao.rotation.x = -Math.PI / 2;
  ao.position.set(0, y + 0.012, 0);
  ao.renderOrder = -1;
  scene.add(ao);

  return { ground, ao, rim, rocks };
}

// Шейдер грунта через onBeforeCompile (без новых проходов рендера):
//  1) макро-вариация яркости (низкочастотный шум) — убивает видимую сетку тайлинга;
//  2) грейзинг-блеск реголита по линии терминатора (тёплый forward-scatter).
function applyGroundShader(mat, macroScale) {
  const sunDirW = SUN_POS.clone().normalize(); // направление НА свет (источник статичен)
  const macroTex = makeNoiseTexture(256, 0.6);
  macroTex.wrapS = macroTex.wrapT = THREE.RepeatWrapping;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDirW = { value: sunDirW };
    shader.uniforms.uSheenColor = { value: new THREE.Color(0.92, 0.8, 0.62) };
    shader.uniforms.uSheenStrength = { value: 0.16 };
    shader.uniforms.uMacroTex = { value: macroTex };
    shader.uniforms.uMacroScale = { value: macroScale };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldNormalG;")
      .replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nvWorldNormalG = normalize(mat3(modelMatrix) * objectNormal);"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWorldNormalG;\nuniform vec3 uSunDirW;\nuniform vec3 uSheenColor;\nuniform float uSheenStrength;\nuniform sampler2D uMacroTex;\nuniform float uMacroScale;"
      )
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\n{\n  float m = texture2D(uMacroTex, vMapUv * uMacroScale).r;\n  float m2 = texture2D(uMacroTex, vMapUv * uMacroScale * 0.37 + 0.5).r;\n  diffuseColor.rgb *= (0.58 + 0.6 * m) * (0.82 + 0.34 * m2);\n}"
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n{\n  float ndlW = dot(normalize(vWorldNormalG), uSunDirW);\n  float graze = smoothstep(0.0, 0.22, ndlW) * (1.0 - smoothstep(0.22, 0.7, ndlW));\n  totalEmissiveRadiance += uSheenColor * graze * uSheenStrength;\n}"
      );
  };
  // Стабильный ключ кэша программы — не плодим шейдеры.
  mat.customProgramCacheKey = () => "ground-pbr-sheen-macro";
}

// Валуны: одна деформированная гео-форма, разбросанная InstancedMesh по рельефу.
function createRocks(groundY, mobile) {
  const base = new THREE.IcosahedronGeometry(1, 1);
  const bp = base.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < bp.count; i++) {
    v.fromBufferAttribute(bp, i);
    const n = 0.65 + 0.35 * vnoise(v.x * 2.5 + 10, v.y * 2.5 + 20) + 0.2 * vnoise(v.z * 4 + 5, v.x * 4);
    v.multiplyScalar(n);
    v.y *= 0.7; // приплюснутые камни
    bp.setXYZ(i, v.x, v.y, v.z);
  }
  base.computeVertexNormals();

  // PBR-камень (Poly Haven rock_boulder_dry, CC0) — выветренный серый валун.
  const rp = `${import.meta.env.BASE_URL}assets/textures/rock/`;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb8b2a8,
    roughness: 1,
    metalness: 0,
    map: loadTex(`${rp}albedo_1k.jpg`, { srgb: true, repeat: 1.6 }),
    normalMap: loadTex(`${rp}normal_1k.jpg`, { repeat: 1.6 }),
    roughnessMap: loadTex(`${rp}rough_1k.jpg`, { repeat: 1.6 })
  });
  const count = mobile ? 44 : 84;
  const inst = new THREE.InstancedMesh(base, mat, count);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const ang = hash(i * 1.7, 3.1) * Math.PI * 2;
    const rad = 4 + hash(i * 2.3, 7.7) * 32; // 4..36, не под ровером
    const wx = Math.cos(ang) * rad;
    const wz = Math.sin(ang) * rad;
    const h = terrainHeight(wx, -wz); // плоскость: lx=wx, lz=-wz
    // Размер: степенное распределение -> много мелкой гальки + редкие крупные валуны.
    const sc = 0.05 + Math.pow(hash(i * 5.1, 1.3), 2.4) * 0.85;
    p.set(wx, groundY + h + sc * 0.22, wz);
    e.set(hash(i, 9) * 0.5, hash(i, 4) * 6.28, hash(i, 2) * 0.5);
    q.setFromEuler(e);
    s.set(sc, sc * (0.7 + hash(i, 8) * 0.5), sc);
    m.compose(p, q, s);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.frustumCulled = false;
  return inst;
}

// Кольцо стен кратера с неровной зубчатой кромкой.
function createCraterRim(groundY) {
  const R = 82;
  const H = 30;
  const geo = new THREE.CylinderGeometry(R, R * 1.04, H, 200, 6, true);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const topness = (v.y + H / 2) / H;
    if (topness > 0.5) {
      const ang = Math.atan2(v.z, v.x);
      const n = Math.sin(ang * 6.0) + Math.sin(ang * 13.0 + 1.3) * 0.55 + Math.sin(ang * 27.0 + 0.7) * 0.3;
      v.y += n * 4.2 * ((topness - 0.5) * 2);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x14131a, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const rim = new THREE.Mesh(geo, mat);
  rim.position.set(0, groundY + H / 2 - 23, 0);
  rim.renderOrder = -3;
  return rim;
}

// Серошкальный fbm-шум в текстуру (для bump/roughness).
function makeNoiseTexture(size, contrast = 0.5, base = 0.5) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let yy = 0; yy < size; yy++) {
    for (let xx = 0; xx < size; xx++) {
      const n = fbm((xx / size) * 8, (yy / size) * 8);
      const val = Math.max(0, Math.min(1, base + (n - 0.5) * contrast * 2));
      const idx = (yy * size + xx) * 4;
      const c = (val * 255) | 0;
      img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = c;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function makeShadowTexture(core = 0.85) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, `rgba(0,0,0,${core})`);
  g.addColorStop(0.45, `rgba(0,0,0,${core * 0.5})`);
  g.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
