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
  // Южный полюс: Солнце скользит почти по горизонту (около 1–2°).
  sun.position.set(-10.0, 0.24, 2.5);

  // Реальные тени (рендерятся только если renderer.shadowMap.enabled — десктоп).
  // Ортокамера тени покрывает «геройскую» зону у ровера (не всю плоскость 400×400,
  // иначе тексели огромные и тень мыльная). target по умолчанию в (0,0,0) — у ровера.
  const mobile = window.innerWidth <= 768 || (window.innerWidth <= 900 && window.innerHeight <= 520);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const sc = sun.shadow.camera;
  const ext = mobile ? 24 : 34;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
  sc.near = 0.5; sc.far = 60;
  sc.updateProjectionMatrix();
  // logarithmicDepthBuffer усиливает shadow acne — давим нормал-биасом (надёжнее bias).
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.022;

  // Earthshine: отражённый от реголита свет — холодный сверху, тёпло-пыльный снизу.
  const hemi = new THREE.HemisphereLight(0x52606c, 0x24211c, d.hemiIntensity);

  // Совсем слабый нейтральный ambient, чтобы тени не были абсолютно чёрными.
  const ambient = new THREE.AmbientLight(0x111216, 0.035);

  scene.add(sun, hemi, ambient);

  return { sun, hemi, ambient };
}
