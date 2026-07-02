import * as THREE from "three";

// Интерактивная инспекция: хотспоты, привязанные к мировым точкам ровера (мачта,
// антенна, энергоблок, подвеска). Проецируем 3D->экран каждый кадр, при наведении/клике
// раскрывается подпись. Видны только на hero (где ровер — герой кадра), плавно гаснут
// при скролле. Привязка по координатам, а не по именам узлов GLB (имена generic).
//
// Координаты — относительно центра ровера; donастраиваются здесь, в OFFSETS.
const OFFSETS = [
  { off: [0.2, 1.5, 0.45], title: "Сенсорная мачта", desc: "Лидар · спектрометр · тепловой канал" },
  { off: [0.95, 0.95, -0.85], title: "Антенна связи", desc: "Релей-спутник · окна 4–9 мин" },
  { off: [-0.45, 0.3, 0.35], title: "Энергоблок", desc: "Накопитель на 14 циклов тени" },
  { off: [1.15, -0.6, 1.05], title: "Подвеска", desc: "Шесть колёс · независимая артикуляция" }
];

export function createHotspots({ roverPos }) {
  const layer = document.createElement("div");
  layer.id = "hotspot-layer";
  layer.style.opacity = "0";
  document.body.appendChild(layer);

  const items = OFFSETS.map((d) => {
    const world = new THREE.Vector3(roverPos.x + d.off[0], roverPos.y + d.off[1], roverPos.z + d.off[2]);
    const elt = document.createElement("button");
    elt.className = "hotspot";
    elt.type = "button";
    elt.setAttribute("aria-label", `${d.title}: ${d.desc}`);
    elt.innerHTML =
      '<span class="hotspot-dot"></span>' +
      '<span class="hotspot-info">' +
      `<span class="hotspot-title">${d.title}</span>` +
      `<span class="hotspot-desc">${d.desc}</span>` +
      "</span>";
    elt.addEventListener("click", () => elt.classList.toggle("is-open"));
    layer.appendChild(elt);
    return { world, elt };
  });

  const _v = new THREE.Vector3();
  let shown = false;

  return {
    // fade: 1 на hero -> 0 при скролле дальше. cam — активная камера.
    update(cam, fade) {
      if (fade <= 0.002) {
        if (shown) {
          layer.style.opacity = "0";
          layer.style.pointerEvents = "none";
          shown = false;
        }
        return;
      }
      if (!shown) {
        layer.style.pointerEvents = "";
        shown = true;
      }
      layer.style.opacity = String(fade);
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (const it of items) {
        _v.copy(it.world).project(cam);
        if (_v.z > 1) {
          it.elt.style.display = "none";
          continue;
        }
        it.elt.style.display = "";
        const x = (_v.x * 0.5 + 0.5) * w;
        const y = (-_v.y * 0.5 + 0.5) * h;
        it.elt.style.transform = `translate(${x}px, ${y}px)`;
      }
    }
  };
}
