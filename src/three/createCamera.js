import * as THREE from "three";
import { CAMERA_KEYFRAMES } from "../config/cameraKeyframes.js";

// Перспективная камера. Стартовую позицию берём из первого ракурса,
// чтобы первый кадр не «прыгал». Дальше всем управляет cameraRig по скроллу.
export function createCamera() {
  const start = CAMERA_KEYFRAMES[0];
  // Поднятый near и умеренный far улучшают точность буфера глубины (меньше z-fighting).
  const camera = new THREE.PerspectiveCamera(
    start.fov,
    window.innerWidth / window.innerHeight,
    0.3,
    140
  );
  camera.position.set(start.cx, start.cy, start.cz);
  camera.lookAt(start.lx, start.ly, start.lz);
  return camera;
}
