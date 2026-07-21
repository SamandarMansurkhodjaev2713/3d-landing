import * as THREE from "three";
import { createGround } from "./createGround.js";

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (value) => value * value * (3 - 2 * value);

// Диагностический разрез ровера. Это не физический «взрыв»: детали расходятся
// по четырём функциональным направлениям, сохраняя читаемый силуэт аппарата.
export function buildExplode(scene, model) {
  model.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const half = size.clone().multiplyScalar(0.5);
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
  const modelDiagonal = Math.max(size.length(), 0.001);

  const root = new THREE.Group();
  root.name = "POLUS_DIAGNOSTIC_CUTAWAY";
  scene.add(root);

  const ground = createGround(scene, box.min.y - 0.02, radius);
  root.attach(ground.contact);

  const meshes = [];
  model.traverse((object) => {
    if (object.isMesh) meshes.push(object);
  });

  const parts = [];
  const bounds = new THREE.Box3();
  const partCenter = new THREE.Vector3();
  const partSize = new THREE.Vector3();
  const relative = new THREE.Vector3();

  for (const mesh of meshes) {
    root.attach(mesh);
    bounds.setFromObject(mesh);
    bounds.getCenter(partCenter);
    bounds.getSize(partSize);
    relative.copy(partCenter).sub(center);

    const nx = half.x > 0 ? relative.x / half.x : 0;
    const ny = half.y > 0 ? relative.y / half.y : 0;
    const nz = half.z > 0 ? relative.z / half.z : 0;
    const edge = clamp01(Math.sqrt(nx * nx + ny * ny + nz * nz) / 1.45);
    const group = classifyPart(nx, ny, nz);
    const direction = directionFor(group, nx, ny, nz);
    const span = clamp01(partSize.length() / modelDiagonal);

    // Мелкие детали двигаются вместе со своим контуром, но на меньшую амплитуду:
    // это сохраняет техническую плотность и не превращает разрез в россыпь болтов.
    const detailWeight = 0.68 + smoothstep(clamp01((span - 0.004) / 0.055)) * 0.32;
    const groupAmplitude = [0.88, 0.7, 0.54, 0.74][group];
    const amplitude = radius * 0.27 * groupAmplitude * (0.82 + edge * 0.18) * detailWeight;
    const delay = 0.06 + group * 0.055 + (1 - edge) * 0.075;

    parts.push({
      mesh,
      origin: mesh.position.clone(),
      offset: direction.multiplyScalar(amplitude),
      group,
      delay
    });
  }

  scene.remove(model);

  let targetAmount = 0;
  let currentAmount = 0;
  const targetFocus = [1, 0, 0, 0];
  const currentFocus = [1, 0, 0, 0];
  const appliedFocus = [-1, -1, -1, -1];
  let lastAppliedAmount = -1;

  function setState(amount, focus = 0) {
    targetAmount = clamp01(amount);
    const active = Math.max(0, Math.min(3, Math.round(focus)));
    for (let i = 0; i < 4; i++) targetFocus[i] = i === active ? 1 : 0;
  }

  function update(dt) {
    const amountDamping = 1 - Math.exp(-dt * 5.4);
    const focusDamping = 1 - Math.exp(-dt * 8.2);
    currentAmount += (targetAmount - currentAmount) * amountDamping;
    for (let i = 0; i < 4; i++) {
      currentFocus[i] += (targetFocus[i] - currentFocus[i]) * focusDamping;
    }

    const focusChanged = currentFocus.some((value, index) => Math.abs(value - appliedFocus[index]) > 0.0015);
    if (!focusChanged && Math.abs(currentAmount - lastAppliedAmount) < 0.00035 &&
        Math.abs(targetAmount - currentAmount) < 0.0005) return;
    lastAppliedAmount = currentAmount;
    for (let i = 0; i < 4; i++) appliedFocus[i] = currentFocus[i];

    for (const part of parts) {
      const local = clamp01((currentAmount - part.delay) / Math.max(0.001, 1 - part.delay));
      const eased = smoothstep(local);
      const emphasis = 0.86 + currentFocus[part.group] * 0.18;
      part.mesh.position.copy(part.origin).addScaledVector(part.offset, eased * emphasis);
    }
  }

  return {
    root,
    explode: {
      setState,
      update,
      setAmount(amount) {
        setState(amount, 0);
      },
      partCount: parts.length
    },
    ground
  };
}

// 0 — ходовая, 1 — сенсорный верх, 2 — термооболочка, 3 — навигационный контур.
function classifyPart(nx, ny, nz) {
  if (ny < -0.24 || (Math.abs(nx) > 0.58 && ny < 0.14)) return 0;
  if (ny > 0.46) return 1;
  if (Math.abs(nx) < 0.5 && Math.abs(nz) < 0.56) return 2;
  return 3;
}

function directionFor(group, nx, ny, nz) {
  const sx = nx < 0 ? -1 : 1;
  const sz = nz < 0 ? -1 : 1;
  const direction = new THREE.Vector3();

  if (group === 0) direction.set(sx, -0.2, nz * 0.18);
  else if (group === 1) direction.set(nx * 0.18, 1, nz * 0.12);
  else if (group === 2) direction.set(sx * 0.82, 0.08, sz * 0.22);
  else direction.set(nx * 0.16, 0.12 + Math.max(0, ny) * 0.08, sz);

  if (direction.lengthSq() < 0.0001) direction.set(0, 1, 0);
  return direction.normalize();
}
