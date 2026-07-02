import * as THREE from "three";
import { SCENE_DEFAULTS } from "../config/scenePresets.js";

// Потолок pixelRatio. Модель тяжёлая (~420k треугольников), поэтому на телефонах
// (высокий DPR) рендерим скромнее — это главный рычаг плавности без потери чёткости.
export function pixelRatioCap() {
  return window.innerWidth <= 768 ? 1.1 : 1.35;
}

// WebGL-рендерер: alpha-фон (тёмный backdrop делает CSS), ACES tone mapping,
// корректное цветовое пространство и ограниченный pixelRatio для производительности.
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    // Лог-буфер глубины убирает z-fighting (мерцание/«ломку» текстур на стыках
    // граней плотной модели и пересекающихся деталей при движении камеры/разборке).
    logarithmicDepthBuffer: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap()));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SCENE_DEFAULTS.exposure;

  // Реальные тени от низкого солнца — только на десктопе (на телефонах лишний
  // проход в карту теней от 400+ мешей ровера бил бы по плавности). PCFSoft — мягкая
  // полутень, дёшево, не конфликтует с logarithmicDepthBuffer.
  if (window.innerWidth > 768) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  return renderer;
}
