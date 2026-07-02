import { SECTION_NAMES } from "../config/cameraKeyframes.js";

// Конфигурация ползунков: ключ ракурса, русский label, диапазон.
const SLIDERS = [
  { key: "x", label: "Позиция ровера X", min: -3, max: 3, step: 0.05 },
  { key: "z", label: "Позиция ровера Z", min: -3, max: 3, step: 0.05 },
  { key: "cx", label: "Камера X", min: -8, max: 8, step: 0.05 },
  { key: "cy", label: "Камера Y", min: -4, max: 8, step: 0.05 },
  { key: "cz", label: "Камера Z", min: -8, max: 10, step: 0.05 },
  { key: "lx", label: "Точка взгляда X", min: -4, max: 4, step: 0.05 },
  { key: "ly", label: "Точка взгляда Y", min: -3, max: 3, step: 0.05 },
  { key: "lz", label: "Точка взгляда Z", min: -4, max: 4, step: 0.05 },
  { key: "fov", label: "FOV / Зум", min: 12, max: 70, step: 0.5 },
  { key: "yaw", label: "Орбитальный поворот", min: -3.14, max: 3.14, step: 0.01 }
];

// Панель камеры: редактор ракурсов по секциям.
// keyframes — тот же мутабельный массив, который читает cameraRig (правки видны вживую).
export function createCameraPanel({ container, keyframes, defaults = keyframes, onClose }) {
  let current = 0;
  const controls = {};

  container.innerHTML = "";

  // Заголовок.
  const head = document.createElement("div");
  head.className = "panel-head";
  head.innerHTML = `<h3 class="panel-title">Настройки камеры</h3>`;
  const closeBtn = makeCloseButton(onClose);
  head.appendChild(closeBtn);

  const subtitle = document.createElement("div");
  subtitle.className = "panel-subtitle";

  // Drag-pad — «потяни, чтобы изменить ракурс» (yaw по X, высота камеры по Y).
  const pad = document.createElement("div");
  pad.className = "drag-pad";
  pad.innerHTML = `<span class="drag-pad__hint">Потяни, чтобы изменить ракурс</span><span class="drag-pad__dot"></span>`;
  setupDragPad(pad, () => keyframes[current], () => syncFields(["yaw", "cy"]));

  // Список ползунков.
  const list = document.createElement("div");
  list.className = "panel-list";
  SLIDERS.forEach((cfg) => {
    const ctrl = createSlider(cfg, (value) => {
      keyframes[current][cfg.key] = value;
    });
    controls[cfg.key] = ctrl;
    list.appendChild(ctrl.row);
  });

  // Кнопки действий.
  const actions = document.createElement("div");
  actions.className = "panel-actions";
  const resetSection = makeButton("Сбросить секцию", () => {
    Object.assign(keyframes[current], defaults[current]);
    syncSection(current);
  });
  const resetAll = makeButton("Сбросить всё", () => {
    keyframes.forEach((k, i) => Object.assign(k, defaults[i]));
    syncSection(current);
  });
  const copyBtn = makeButton("Скопировать значения", () => {
    copyText(JSON.stringify(keyframes[current], null, 2), copyBtn, "Скопировать значения");
  });
  actions.append(resetSection, resetAll, copyBtn);

  container.append(head, subtitle, pad, list, actions);

  function syncFields(keys) {
    const kf = keyframes[current];
    keys.forEach((k) => controls[k] && controls[k].set(kf[k]));
  }

  function syncSection(index) {
    current = index;
    subtitle.textContent = `${SECTION_NAMES[index]} · ракурс ${index + 1}/${SECTION_NAMES.length}`;
    const kf = keyframes[index];
    SLIDERS.forEach((cfg) => controls[cfg.key].set(kf[cfg.key]));
  }

  syncSection(0);

  return { syncSection };
}

// --- drag-pad ---
function setupDragPad(pad, getKf, onChange) {
  let dragging = false;
  pad.addEventListener("pointerdown", (e) => {
    dragging = true;
    pad.setPointerCapture(e.pointerId);
    pad.classList.add("is-dragging");
  });
  pad.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const kf = getKf();
    kf.yaw = clamp(kf.yaw + e.movementX * 0.01, -3.14, 3.14);
    kf.cy = clamp(kf.cy - e.movementY * 0.02, -4, 8);
    onChange();
  });
  const end = () => {
    dragging = false;
    pad.classList.remove("is-dragging");
  };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);
}

// --- общие хелперы UI ---
function createSlider(cfg, onInput) {
  const decimals = decimalsOf(cfg.step);

  const row = document.createElement("label");
  row.className = "control";

  const top = document.createElement("div");
  top.className = "control-top";
  const name = document.createElement("span");
  name.className = "control-label";
  name.textContent = cfg.label;
  const val = document.createElement("span");
  val.className = "control-value";
  top.append(name, val);

  const input = document.createElement("input");
  input.type = "range";
  input.min = cfg.min;
  input.max = cfg.max;
  input.step = cfg.step;

  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    val.textContent = v.toFixed(decimals);
    onInput(v);
  });

  row.append(top, input);

  return {
    row,
    set(value) {
      input.value = value;
      val.textContent = Number(value).toFixed(decimals);
    }
  };
}

function makeButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "panel-btn";
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function makeCloseButton(onClose) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "panel-close";
  btn.setAttribute("aria-label", "Закрыть панель");
  btn.textContent = "×";
  if (onClose) btn.addEventListener("click", onClose);
  return btn;
}

function copyText(text, btn, original) {
  const done = () => {
    btn.textContent = "Скопировано";
    setTimeout(() => (btn.textContent = original), 1200);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(done);
  } else {
    done();
  }
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const decimalsOf = (step) => {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
};

export { createSlider, makeButton, makeCloseButton, copyText };
