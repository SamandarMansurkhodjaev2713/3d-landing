import * as THREE from "three";
import { SCENE_DEFAULTS } from "../config/scenePresets.js";

const rgb = (r, g, b) => new THREE.Color(r / 255, g / 255, b / 255);

// Колор-скрипт: один мотивированный источник + отражённый от грунта свет.
// Жёлтый ровер остаётся единственным цветовым событием в нейтральном кадре.
// Возвращает ссылки на источники — панель сцены меняет их в рантайме.
export function createLights(scene) {
  const d = SCENE_DEFAULTS;

  // «Солнце у лунного горизонта» — очень низкий, скользящий угол (полярный день),
  // даёт длинные тени и резкий светотеневой раздел на корпусе и грунте.
  const sun = new THREE.DirectionalLight(rgb(d.sunColorR, d.sunColorG, d.sunColorB), d.sunIntensity);
  sun.position.set(-8.0, 1.7, 3.2);

  // Реальные тени (рендерятся только если renderer.shadowMap.enabled — десктоп).
  // Ортокамера тени покрывает «геройскую» зону у ровера (не всю плоскость 400×400,
  // иначе тексели огромные и тень мыльная). target по умолчанию в (0,0,0) — у ровера.
  const mobile = window.innerWidth <= 768;
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const sc = sun.shadow.camera;
  const ext = mobile ? 25 : 40;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
  sc.near = 0.5; sc.far = 60;
  sc.updateProjectionMatrix();
  // logarithmicDepthBuffer усиливает shadow acne — давим нормал-биасом (надёжнее bias).
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;

  // Earthshine: отражённый от реголита свет — холодный сверху, тёпло-пыльный снизу.
  const hemi = new THREE.HemisphereLight(0x8a93a3, 0x4a4036, d.hemiIntensity);

  // Совсем слабый нейтральный ambient, чтобы тени не были абсолютно чёрными.
  const ambient = new THREE.AmbientLight(0x20222a, 0.16);

  scene.add(sun, hemi, ambient);

  return { sun, hemi, ambient };
}
