import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { ASSETS } from "../config/assets.js";
import { SCENE_DEFAULTS } from "../config/scenePresets.js";
import { buildExplode } from "./explode.js";

// Базовый масштаб модели в сцене. При смене GLB можно подправить одно число.
const TARGET_SIZE = 4.2;
const Y_OFFSET = 0.55; // визуально опускаем модель чуть ниже центра кадра

// Загрузка ровера: GLTFLoader + DRACOLoader (на случай draco-сжатой модели —
// если модель не сжата, декодер просто не вызывается). Авто-центр и авто-масштаб.
// onProgress(percent) — для индикатора загрузки.
export function loadRoverModel(scene, onProgress) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`); // локальный декодер (public/draco), с учётом base

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  return new Promise((resolve, reject) => {
    loader.load(
      ASSETS.model,
      (gltf) => {
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = TARGET_SIZE / maxDim;

        model.scale.setScalar(scale);
        const base = new THREE.Vector3(
          -center.x * scale,
          -center.y * scale - Y_OFFSET,
          -center.z * scale
        );
        model.position.copy(base);

        model.traverse((child) => {
          if (!child.isMesh) return;
          // Ровер отбрасывает и принимает реальные тени (на десктопе, где shadowMap включён).
          child.castShadow = true;
          child.receiveShadow = true;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of mats) {
            if (!mat) continue;
            if ("envMapIntensity" in mat) mat.envMapIntensity = SCENE_DEFAULTS.hdrIntensity;
            // Анизотропная фильтрation — текстуры не «плывут»/не мерцают под острым углом.
            for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"]) {
              const tex = mat[key];
              if (tex && tex.isTexture) {
                tex.anisotropy = 8;
                tex.needsUpdate = true;
              }
            }
            mat.needsUpdate = true;
          }
        });

        // Сплющиваем иерархию и строим разборку. root заменяет модель в сцене:
        // смещение по ракурсам теперь нулевое (всё запечено), им управляет explode.
        const { root, explode } = buildExplode(scene, model);

        draco.dispose();
        resolve({ model: root, base: new THREE.Vector3(0, 0, 0), explode });
      },
      (event) => {
        if (onProgress && event.lengthComputable) {
          onProgress(event.loaded / event.total);
        } else if (onProgress) {
          onProgress(null); // длина неизвестна — индикатор покажет неопределённый прогресс
        }
      },
      (err) => {
        draco.dispose();
        reject(err);
      }
    );
  });
}
