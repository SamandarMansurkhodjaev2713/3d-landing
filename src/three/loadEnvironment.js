import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { ASSETS } from "../config/assets.js";
import { SCENE_DEFAULTS } from "../config/scenePresets.js";

// Загружает HDRI, прогоняет через PMREM и ставит как scene.environment
// (отражения/освещение материалов). Фон остаётся прозрачным — его рисует CSS.
// Возвращает контроллер для панели сцены: яркость и поворот окружения.
export function loadEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  return new Promise((resolve, reject) => {
    new RGBELoader().load(
      ASSETS.hdr.main,
      (hdr) => {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const envMap = pmrem.fromEquirectangular(hdr).texture;

        scene.environment = envMap;
        if ("environmentIntensity" in scene) {
          scene.environmentIntensity = SCENE_DEFAULTS.hdrIntensity;
        }
        applyRotation(scene, SCENE_DEFAULTS.envRotation);

        hdr.dispose();
        pmrem.dispose();

        resolve({
          envMap,
          setIntensity(value) {
            if ("environmentIntensity" in scene) scene.environmentIntensity = value;
          },
          setRotation(radians) {
            applyRotation(scene, radians);
          }
        });
      },
      undefined,
      (err) => reject(err)
    );
  });
}

function applyRotation(scene, radians) {
  if (scene.environmentRotation) {
    scene.environmentRotation.set(0, radians, 0);
  }
  if (scene.backgroundRotation) {
    scene.backgroundRotation.set(0, radians, 0);
  }
}
