import * as THREE from "three";
import { createGround } from "./createGround.js";

// Разборка ровера по скроллу. Модель — 423 меша в глубокой иерархии с трансформами,
// поэтому «сплющиваем» её: через root.attach(mesh) каждый меш сохраняет мировой
// трансформ, но становится прямым ребёнком группы с единичной матрицей. После этого
// смещать деталь наружу можно простым mesh.position += dir (локальное = мировое).
//
// Возвращает { root, explode } — root заменяет модель в сцене и в камера-риге.
export function buildExplode(scene, model) {
  model.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;

  const root = new THREE.Group();
  scene.add(root);

  // Грунт ставим точно под самую нижнюю точку аппарата — он касается поверхности.
  const ground = createGround(scene, box.min.y - 0.02, radius);
  root.attach(ground.contact);

  const meshes = [];
  model.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });

  const parts = [];
  const _bb = new THREE.Box3();
  const _c = new THREE.Vector3();

  meshes.forEach((m) => {
    root.attach(m); // переносим меш в root, сохраняя мировой трансформ
    _bb.setFromObject(m);
    _bb.getCenter(_c);

    const dir = _c.clone().sub(center);
    dir.y *= 0.5; // разлёт преимущественно горизонтальный — читается как «раскрытие»
    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
    const dist = dir.length();
    dir.normalize();

    parts.push({
      mesh: m,
      orig: m.position.clone(),
      dir,
      distNorm: Math.min(1, dist / (radius * 1.2))
    });
  });

  scene.remove(model);

  const MAX = radius * 0.32; // максимальный разлёт детали — сдержанно, «раскрытие», не «осколки»
  const STAG = 0.45; // стаггер: внешние детали уходят раньше внутренних
  let last = -1;

  function setAmount(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    if (Math.abs(t - last) < 0.0015) return;
    last = t;
    for (const p of parts) {
      const start = (1 - p.distNorm) * STAG; // внутренние стартуют позже
      let e = (t - start) / (1 - STAG);
      e = e < 0 ? 0 : e > 1 ? 1 : e;
      e = e * e * (3 - 2 * e); // smoothstep
      const mag = e * MAX * (0.5 + p.distNorm); // внешние уходят дальше
      p.mesh.position.copy(p.orig).addScaledVector(p.dir, mag);
    }
  }

  return { root, explode: { setAmount, partCount: parts.length }, ground };
}
