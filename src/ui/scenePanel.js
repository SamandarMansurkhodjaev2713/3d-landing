import { SCENE_DEFAULTS } from "../config/scenePresets.js";
import { createSlider, makeButton, makeCloseButton, copyText } from "./cameraPanel.js";

// Ползунки сцены под новый колор-скрипт: солнце, отражённый свет, экспозиция, окружение.
const SLIDERS = [
  { key: "exposure", label: "Экспозиция", min: 0, max: 4, step: 0.05 },
  { key: "sunIntensity", label: "Интенсивность солнца", min: 0, max: 6, step: 0.05 },
  { key: "sunColorR", label: "Солнце · R", min: 0, max: 255, step: 1 },
  { key: "sunColorG", label: "Солнце · G", min: 0, max: 255, step: 1 },
  { key: "sunColorB", label: "Солнце · B", min: 0, max: 255, step: 1 },
  { key: "hemiIntensity", label: "Отражённый свет грунта", min: 0, max: 2, step: 0.05 },
  { key: "hdrIntensity", label: "Окружение HDR", min: 0, max: 3, step: 0.05 },
  { key: "envRotation", label: "Поворот окружения", min: 0, max: 6.28, step: 0.01 }
];

// Панель сцены: свет, экспозиция, окружение.
// refs = { renderer, lights:{sun,hemi}, env } — env подставляется после загрузки HDRI.
export function createScenePanel({ container, refs, onClose }) {
  const state = { ...SCENE_DEFAULTS };
  const controls = {};

  container.innerHTML = "";

  const head = document.createElement("div");
  head.className = "panel-head";
  head.innerHTML = `<h3 class="panel-title">Настройки сцены</h3>`;
  head.appendChild(makeCloseButton(onClose));

  const list = document.createElement("div");
  list.className = "panel-list";
  SLIDERS.forEach((cfg) => {
    const ctrl = createSlider(cfg, (value) => {
      state[cfg.key] = value;
      apply(cfg.key);
    });
    controls[cfg.key] = ctrl;
    ctrl.set(state[cfg.key]);
    list.appendChild(ctrl.row);
  });

  const actions = document.createElement("div");
  actions.className = "panel-actions";
  const resetBtn = makeButton("Сбросить всё", () => {
    Object.assign(state, SCENE_DEFAULTS);
    SLIDERS.forEach((cfg) => controls[cfg.key].set(state[cfg.key]));
    applyAll();
  });
  const copyBtn = makeButton("Скопировать значения", () => {
    copyText(JSON.stringify(roundState(state), null, 2), copyBtn, "Скопировать значения");
  });
  actions.append(resetBtn, copyBtn);

  container.append(head, list, actions);

  function apply(key) {
    const { renderer, lights, env } = refs;
    switch (key) {
      case "exposure":
        renderer.toneMappingExposure = state.exposure;
        break;
      case "sunIntensity":
        lights.sun.intensity = state.sunIntensity;
        break;
      case "sunColorR":
      case "sunColorG":
      case "sunColorB":
        lights.sun.color.setRGB(state.sunColorR / 255, state.sunColorG / 255, state.sunColorB / 255);
        break;
      case "hemiIntensity":
        lights.hemi.intensity = state.hemiIntensity;
        break;
      case "hdrIntensity":
        if (env) env.setIntensity(state.hdrIntensity);
        break;
      case "envRotation":
        if (env) env.setRotation(state.envRotation);
        break;
    }
  }

  function applyAll() {
    ["exposure", "sunIntensity", "sunColorR", "hemiIntensity", "hdrIntensity", "envRotation"].forEach(apply);
  }

  applyAll();

  return {
    bindEnvironment(env) {
      refs.env = env;
      env.setIntensity(state.hdrIntensity);
      env.setRotation(state.envRotation);
    }
  };
}

function roundState(state) {
  const out = {};
  for (const k in state) out[k] = Math.round(state[k] * 1000) / 1000;
  return out;
}
