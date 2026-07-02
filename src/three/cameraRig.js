import * as THREE from "three";

// smootherstep — мягкое ускорение/торможение перехода между ракурсами.
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

// Поля ракурса, которые интерполируются между секциями.
const FIELDS = ["x", "z", "cx", "cy", "cz", "lx", "ly", "lz", "fov", "yaw"];

// Управляет камерой и положением ровера по скроллу страницы.
// keyframes — мутабельный массив (его правит панель камеры вживую).
// distanceScale — множитель дистанции камеры от точки взгляда: на мобильных >1,
// чтобы ровер был чуть дальше и кадр дышал (портретный экран его «приближает»).
export function createCameraRig({ camera, keyframes, sections, reducedMotion = false, distanceScale = 1 }) {
  const cur = { ...keyframes[0] }; // текущее сглаженное состояние
  const target = { ...keyframes[0] }; // целевое (по позиции скролла)

  let tops = [];
  let maxScroll = 1;
  let roverModel = null;
  let roverBase = new THREE.Vector3();

  let progress = 0;
  let sectionFloat = 0;
  let activeIndex = 0;

  const _pos = new THREE.Vector3();
  const _look = new THREE.Vector3();

  function refresh() {
    tops = sections.map((s) => s.offsetTop);
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  function setRoverModel(model, base) {
    roverModel = model;
    roverBase.copy(base);
  }

  // Вычисляем дробную позицию по секциям и целевой ракурс из двух соседних кейфреймов.
  function computeTarget() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    progress = THREE.MathUtils.clamp(scrollY / maxScroll, 0, 1);

    const last = tops.length - 1;
    let i = 0;
    while (i < last && scrollY >= tops[i + 1]) i++;

    let localT = 0;
    const span = tops[i + 1] - tops[i];
    if (i < last && span > 0) {
      localT = THREE.MathUtils.clamp((scrollY - tops[i]) / span, 0, 1);
    }
    sectionFloat = i + localT;
    activeIndex = Math.round(sectionFloat);

    const a = keyframes[i];
    const b = keyframes[Math.min(i + 1, last)];
    const e = smoother(localT);
    for (const f of FIELDS) target[f] = lerp(a[f], b[f], e);
  }

  function update(dt) {
    computeTarget();

    // Кадрово-независимое демпфирование текущего состояния к целевому.
    // При reduced-motion сходимся быстрее (меньше плавной инерции).
    const speed = reducedMotion ? 16 : 6;
    const k = 1 - Math.exp(-dt * speed);
    for (const f of FIELDS) cur[f] = lerp(cur[f], target[f], k);

    // Камера: позиция, орбитальный поворот yaw вокруг точки взгляда, fov.
    _look.set(cur.lx, cur.ly, cur.lz);

    // Смещение камеры относительно точки взгляда.
    const ox = cur.cx - cur.lx;
    const oy = cur.cy - cur.ly;
    const oz = cur.cz - cur.lz;

    // Орбитальный поворот yaw вокруг оси Y.
    const cos = Math.cos(cur.yaw);
    const sin = Math.sin(cur.yaw);
    const rx = ox * cos - oz * sin;
    const rz = ox * sin + oz * cos;

    // Отдаляем камеру множителем дистанции (на мобильных ровер дальше).
    _pos.set(
      _look.x + rx * distanceScale,
      _look.y + oy * distanceScale,
      _look.z + rz * distanceScale
    );

    camera.position.copy(_pos);
    camera.lookAt(_look);
    if (Math.abs(camera.fov - cur.fov) > 0.001) {
      camera.fov = cur.fov;
      camera.updateProjectionMatrix();
    }

    // Ровер: базовая (отцентрованная) позиция + смещение из ракурса.
    if (roverModel) {
      roverModel.position.set(roverBase.x + cur.x, roverBase.y, roverBase.z + cur.z);
    }
  }

  refresh();

  return {
    update,
    refresh,
    setRoverModel,
    get progress() {
      return progress;
    },
    get sectionFloat() {
      return sectionFloat;
    },
    get activeIndex() {
      return activeIndex;
    },
    // Снимок состояния для живого HUD (телеметрия читает реальные значения сцены).
    get state() {
      return { progress, sectionFloat, activeIndex, yaw: cur.yaw, fov: cur.fov };
    },
    // Поставить ровер и сглаженное состояние камеры точно в ракурс i (для интро):
    // ровер не «прыгнет» при передаче управления ригу после вступительной анимации.
    parkRover(i) {
      Object.assign(cur, keyframes[i], { yaw: keyframes[i].yaw });
      if (roverModel) {
        roverModel.position.set(roverBase.x + keyframes[i].x, roverBase.y, roverBase.z + keyframes[i].z);
      }
    },
    // Точная мировая поза камеры для ракурса i (с yaw-орбитой и distanceScale) —
    // нужна вступительной анимации, чтобы хэндофф в риг был без рывка.
    poseAt(i) {
      const k = keyframes[i];
      const ox = k.cx - k.lx;
      const oy = k.cy - k.ly;
      const oz = k.cz - k.lz;
      const cos = Math.cos(k.yaw);
      const sin = Math.sin(k.yaw);
      const rx = ox * cos - oz * sin;
      const rz = ox * sin + oz * cos;
      return {
        px: k.lx + rx * distanceScale,
        py: k.ly + oy * distanceScale,
        pz: k.lz + rz * distanceScale,
        lx: k.lx,
        ly: k.ly,
        lz: k.lz,
        fov: k.fov
      };
    },
    keyframes
  };
}
