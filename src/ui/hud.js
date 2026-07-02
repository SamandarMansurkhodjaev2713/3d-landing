// Живой бортовой HUD: вертикальная телеметрия, считывающая реальное состояние сцены.
// Значения берутся из cameraRig (прогресс скролла + yaw камеры) и бортовых часов —
// скролл становится дугой выживания аппарата в тени. На восстановлении связи — глитч.

const BORT_START = 3 * 3600 + 41 * 60; // бортовое время старта: 03:41:00

// Состояние линка по секциям (0..5).
const LINK = [
  "ЛИНК ОКНО 04:12",
  "ЛИНК ТИШИНА·КЭШ",
  "ЛИНК ТИШИНА·КЭШ",
  "ЛИНК ОКНО 02:38",
  "ЛИНК ПОТЕРЯ —",
  "ЛИНК ВОССТ. ↑"
];
const GLITCH_ON = new Set([3, 5]); // секции, где связь возвращается

// Опорные значения по секциям — интерполируются по дробной позиции скролла.
const BATTERY = [20, 18, 16, 13, 11, 14]; // %, садится в тени, чуть растёт на гребне
const DIST = [0, 210, 540, 980, 1450, 2140]; // пройдено, м

const GL = "▚▞░▒▓01/\\|<>";

export function createHud(container) {
  container.innerHTML = "";

  ["tl", "tr", "bl", "br"].forEach((pos) => {
    const corner = document.createElement("span");
    corner.className = `hud-corner hud-corner--${pos}`;
    container.appendChild(corner);
  });

  const rail = document.createElement("div");
  rail.className = "hud-rail";
  container.appendChild(rail);

  let prevIndex = -1;
  let glitchUntil = 0;

  return {
    update(rig, elapsed) {
      const st = rig.state;
      const sf = st.sectionFloat;
      const idx = st.activeIndex;

      if (idx !== prevIndex) {
        prevIndex = idx;
        if (GLITCH_ON.has(idx)) glitchUntil = elapsed + 0.4; // короткая пачка глитча
      }

      const bat = Math.round(lerpArr(BATTERY, sf));
      const dist = Math.round(lerpArr(DIST, sf) / 10) * 10;
      const az = Math.round(((((st.yaw * 180) / Math.PI) % 360) + 360) % 360);
      const link = LINK[idx] || LINK[0];
      const time = clock(BORT_START + elapsed);

      let line = `БАТ ${bat}%   ·   ${time}   ·   ПРОЙДЕНО ${dist} М   ·   ${link}   ·   АЗ ${String(az).padStart(3, "0")}°`;

      if (elapsed < glitchUntil) {
        line = scramble(line);
        rail.classList.add("is-glitch");
      } else {
        rail.classList.remove("is-glitch");
      }
      rail.textContent = line;
    }
  };
}

function lerpArr(arr, t) {
  const i = Math.max(0, Math.min(arr.length - 1, Math.floor(t)));
  const j = Math.min(arr.length - 1, i + 1);
  return arr[i] + (arr[j] - arr[i]) * (t - i);
}

function clock(sec) {
  const s = Math.floor(sec);
  const hh = String(Math.floor(s / 3600) % 24).padStart(2, "0");
  const mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// Частичная порча символов — читается как помеха в момент восстановления линка.
function scramble(str) {
  let out = "";
  for (const ch of str) {
    out += ch !== " " && Math.random() < 0.28 ? GL[(Math.random() * GL.length) | 0] : ch;
  }
  return out;
}
